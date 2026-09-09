-- ================================================================
--  ARG INDUMENTARIA - Consultas de cotizacion
--
--  Este script se corre SOBRE LA BASE QUE YA EXISTE.
--  (setup-supabase.sql es para armar una base nueva desde cero;
--   si ya la corriste, no la vuelvas a correr.)
--
--  Supabase Dashboard -> SQL Editor -> New query -> pegar -> Run.
-- ================================================================


-- ────────────────────────────────────────────────────────────────
-- 1. LA TABLA
-- ────────────────────────────────────────────────────────────────

-- Numero legible para el cliente: CO-000001
CREATE SEQUENCE IF NOT EXISTS consulta_number_seq;

CREATE TABLE IF NOT EXISTS consultas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero      text UNIQUE DEFAULT ('CO-' || LPAD(nextval('consulta_number_seq')::text, 6, '0')),
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),

  -- El vehiculo. Todo texto libre a proposito: el Corvette del 68 no
  -- esta en ninguna lista, y si el formulario obliga a elegir de una
  -- lista donde no esta, perdemos justo al cliente que mas nos sirve.
  vehiculo_marca   text NOT NULL,
  vehiculo_modelo  text NOT NULL,
  vehiculo_anio    text NOT NULL,
  vehiculo_motor   text,
  vin              text,              -- resuelve la pieza exacta en europeos

  -- La pieza
  pieza_descripcion text NOT NULL,
  pieza_oem         text,
  fotos             text[],           -- URLs en el bucket "consultas"

  -- Como lo contactamos
  nombre             text NOT NULL,
  email              text NOT NULL,
  whatsapp           text,
  contacto_preferido text DEFAULT 'email'
                     CHECK (contacto_preferido IN ('email', 'whatsapp')),
  user_id            uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Gestion interna (lo carga el admin al responder)
  estado          text DEFAULT 'nueva'
                  CHECK (estado IN ('nueva', 'en_proceso', 'cotizada', 'cerrada', 'perdida')),
  precio_cotizado numeric(12,2),
  plazo_estimado  text,
  notas_internas  text
);

CREATE INDEX IF NOT EXISTS idx_consultas_estado  ON consultas(estado);
CREATE INDEX IF NOT EXISTS idx_consultas_fecha   ON consultas(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_consultas_usuario ON consultas(user_id);

DROP TRIGGER IF EXISTS trg_consultas_updated_at ON consultas;
CREATE TRIGGER trg_consultas_updated_at
  BEFORE UPDATE ON consultas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ────────────────────────────────────────────────────────────────
-- 2. PERMISOS
--    La consulta la manda cualquiera (es un formulario publico),
--    pero leerlas y responderlas es solo del admin.
-- ────────────────────────────────────────────────────────────────

ALTER TABLE consultas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "consultas_admin_todo"   ON consultas;
DROP POLICY IF EXISTS "consultas_ver_la_propia" ON consultas;

CREATE POLICY "consultas_admin_todo"
  ON consultas FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- Un usuario logueado puede ver las consultas que mando el
CREATE POLICY "consultas_ver_la_propia"
  ON consultas FOR SELECT
  USING (user_id IS NOT NULL AND user_id = auth.uid());

-- Nadie inserta directo en la tabla: se entra por crear_consulta()
REVOKE INSERT ON consultas FROM anon, authenticated;
GRANT SELECT ON consultas TO authenticated;


-- ────────────────────────────────────────────────────────────────
-- 3. LIMITE ANTI-SPAM
--    Es un formulario abierto sin captcha: 5 consultas por email
--    cada 24 horas alcanza para un cliente de verdad y corta el
--    envio automatizado.
-- ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION check_consulta_rate_limit(p_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COUNT(*) < 5
  FROM consultas
  WHERE lower(email) = lower(p_email)
    AND created_at > now() - interval '24 hours';
$$;

REVOKE EXECUTE ON FUNCTION check_consulta_rate_limit(text) FROM PUBLIC, anon, authenticated;


-- ────────────────────────────────────────────────────────────────
-- 4. LA FUNCION QUE USA EL FORMULARIO
--    SECURITY DEFINER, igual que place_order(): entra sin permisos
--    de escritura sobre la tabla y devuelve el numero de consulta
--    para mostrarselo al cliente.
-- ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION crear_consulta(
  p_vehiculo_marca   text,
  p_vehiculo_modelo  text,
  p_vehiculo_anio    text,
  p_pieza_descripcion text,
  p_nombre           text,
  p_email            text,
  p_vehiculo_motor   text  DEFAULT NULL,
  p_vin              text  DEFAULT NULL,
  p_pieza_oem        text  DEFAULT NULL,
  p_fotos            text[] DEFAULT NULL,
  p_whatsapp         text  DEFAULT NULL,
  p_contacto_preferido text DEFAULT 'email',
  p_user_id          uuid  DEFAULT NULL
)
RETURNS TABLE(consulta_id uuid, consulta_numero text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id  uuid;
  v_num text;
BEGIN
  IF p_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
    RAISE EXCEPTION 'email_invalido';
  END IF;

  IF NOT check_consulta_rate_limit(p_email) THEN
    RAISE EXCEPTION 'demasiadas_consultas';
  END IF;

  INSERT INTO consultas (
    vehiculo_marca, vehiculo_modelo, vehiculo_anio, vehiculo_motor, vin,
    pieza_descripcion, pieza_oem, fotos,
    nombre, email, whatsapp, contacto_preferido, user_id
  ) VALUES (
    left(trim(p_vehiculo_marca), 80),
    left(trim(p_vehiculo_modelo), 120),
    left(trim(p_vehiculo_anio), 20),
    left(trim(p_vehiculo_motor), 80),
    left(trim(p_vin), 40),
    left(trim(p_pieza_descripcion), 2000),
    left(trim(p_pieza_oem), 80),
    p_fotos,
    left(trim(p_nombre), 150),
    lower(trim(p_email)),
    left(trim(p_whatsapp), 40),
    COALESCE(p_contacto_preferido, 'email'),
    p_user_id
  )
  RETURNING id, numero INTO v_id, v_num;

  RETURN QUERY SELECT v_id, v_num;
END;
$$;

GRANT EXECUTE ON FUNCTION crear_consulta(
  text, text, text, text, text, text, text, text, text, text[], text, text, uuid
) TO anon, authenticated;


-- ────────────────────────────────────────────────────────────────
-- 5. BUCKET PARA LAS FOTOS
--    "Mandame una foto de la pieza" es lo que ya pasa por WhatsApp;
--    la foto de la etiqueta con el numero resuelve casi cualquier
--    consulta.
--
--    Nota: para que un visitante sin cuenta pueda adjuntar, el
--    bucket acepta subida anonima. Se acota con el limite de 5 MB
--    por archivo y con la lista de tipos permitidos (solo imagenes).
-- ────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'consultas', 'consultas', true, 5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE
  SET file_size_limit   = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Fotos de consulta: subida"  ON storage.objects;
DROP POLICY IF EXISTS "Fotos de consulta: lectura" ON storage.objects;
DROP POLICY IF EXISTS "Fotos de consulta: borrado" ON storage.objects;

CREATE POLICY "Fotos de consulta: subida"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'consultas');

CREATE POLICY "Fotos de consulta: lectura"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'consultas');

CREATE POLICY "Fotos de consulta: borrado"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'consultas' AND is_admin());


-- ────────────────────────────────────────────────────────────────
-- 6. VERIFICACION
-- ────────────────────────────────────────────────────────────────
-- Tiene que devolver la tabla con RLS activo y sus 2 policies.
SELECT
  (SELECT count(*) FROM pg_tables  WHERE tablename = 'consultas')            AS tabla,
  (SELECT count(*) FROM pg_policies WHERE tablename = 'consultas')           AS policies,
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'consultas')          AS rls_activo;

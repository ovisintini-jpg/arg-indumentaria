-- ================================================================
--  ARG INDUMENTARIA - Boton de arrepentimiento
--
--  Resolucion 424/2020 (Secretaria de Comercio Interior) + art. 34
--  de la Ley 24.240: el cliente tiene que poder pedir la revocacion
--  de la compra desde un link visible en la home, SIN registrarse,
--  y hay que darle un codigo de identificacion del tramite dentro
--  de las 24 horas.
--
--  Este script se corre SOBRE LA BASE QUE YA EXISTE.
--  Supabase Dashboard -> SQL Editor -> New query -> pegar -> Run.
-- ================================================================


-- ────────────────────────────────────────────────────────────────
-- 1. LA TABLA
-- ────────────────────────────────────────────────────────────────

-- El codigo que se le muestra y se le manda al cliente: ARR-000001.
-- Es el "numero de codigo de identificacion de arrepentimiento" que
-- exige el art. 2 de la Resolucion 424/2020.
CREATE SEQUENCE IF NOT EXISTS arrepentimiento_number_seq;

CREATE TABLE IF NOT EXISTS arrepentimientos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo      text UNIQUE DEFAULT ('ARR-' || LPAD(nextval('arrepentimiento_number_seq')::text, 6, '0')),
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),

  -- Quien pide la revocacion. Pedimos lo minimo indispensable para
  -- identificar la compra: la norma prohibe exigir registro previo
  -- o cualquier tramite extra.
  nombre      text NOT NULL,
  email       text NOT NULL,
  telefono    text,
  documento   text,               -- DNI o CUIT, opcional

  -- La compra
  pedido_numero  text,            -- si lo tiene a mano
  fecha_compra   date,
  producto       text,            -- que pieza quiere devolver
  motivo         text,            -- OPCIONAL: no esta obligado a justificar

  -- Gestion interna
  estado         text DEFAULT 'recibido'
                 CHECK (estado IN ('recibido', 'en_proceso', 'retiro_coordinado', 'reintegrado', 'rechazado')),
  notas_internas text,
  user_id        uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_arrepentimientos_estado ON arrepentimientos(estado);
CREATE INDEX IF NOT EXISTS idx_arrepentimientos_fecha  ON arrepentimientos(created_at DESC);

DROP TRIGGER IF EXISTS trg_arrepentimientos_updated_at ON arrepentimientos;
CREATE TRIGGER trg_arrepentimientos_updated_at
  BEFORE UPDATE ON arrepentimientos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ────────────────────────────────────────────────────────────────
-- 2. PERMISOS
--    Lo manda cualquiera (formulario publico y sin login, por ley).
--    Leerlo y gestionarlo es solo del admin.
-- ────────────────────────────────────────────────────────────────

ALTER TABLE arrepentimientos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "arrepentimientos_admin_todo"    ON arrepentimientos;
DROP POLICY IF EXISTS "arrepentimientos_ver_el_propio" ON arrepentimientos;

CREATE POLICY "arrepentimientos_admin_todo"
  ON arrepentimientos FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "arrepentimientos_ver_el_propio"
  ON arrepentimientos FOR SELECT
  USING (user_id IS NOT NULL AND user_id = auth.uid());

-- Nadie inserta directo en la tabla: se entra por crear_arrepentimiento()
REVOKE INSERT ON arrepentimientos FROM anon, authenticated;
GRANT SELECT ON arrepentimientos TO authenticated;


-- ────────────────────────────────────────────────────────────────
-- 3. LIMITE ANTI-SPAM
--    Mismo criterio que las consultas. Ojo: se deja holgado a
--    proposito. Trabarle el arrepentimiento a un cliente real es
--    justo lo que la norma castiga.
-- ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION check_arrepentimiento_rate_limit(p_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COUNT(*) < 10
  FROM arrepentimientos
  WHERE lower(email) = lower(p_email)
    AND created_at > now() - interval '24 hours';
$$;

REVOKE EXECUTE ON FUNCTION check_arrepentimiento_rate_limit(text) FROM PUBLIC, anon, authenticated;


-- ────────────────────────────────────────────────────────────────
-- 4. LA FUNCION QUE USA EL FORMULARIO
--    Devuelve el codigo para mostrarselo al cliente en pantalla,
--    ademas del mail de acuse.
-- ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION crear_arrepentimiento(
  p_nombre        text,
  p_email         text,
  p_telefono      text DEFAULT NULL,
  p_documento     text DEFAULT NULL,
  p_pedido_numero text DEFAULT NULL,
  p_fecha_compra  date DEFAULT NULL,
  p_producto      text DEFAULT NULL,
  p_motivo        text DEFAULT NULL,
  p_user_id       uuid DEFAULT NULL
)
RETURNS TABLE(arrepentimiento_id uuid, arrepentimiento_codigo text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id  uuid;
  v_cod text;
BEGIN
  IF p_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
    RAISE EXCEPTION 'email_invalido';
  END IF;

  IF NOT check_arrepentimiento_rate_limit(p_email) THEN
    RAISE EXCEPTION 'demasiadas_solicitudes';
  END IF;

  INSERT INTO arrepentimientos (
    nombre, email, telefono, documento,
    pedido_numero, fecha_compra, producto, motivo, user_id
  ) VALUES (
    left(trim(p_nombre), 150),
    lower(trim(p_email)),
    left(trim(p_telefono), 40),
    left(trim(p_documento), 40),
    left(trim(p_pedido_numero), 40),
    p_fecha_compra,
    left(trim(p_producto), 2000),
    left(trim(p_motivo), 2000),
    p_user_id
  )
  RETURNING id, codigo INTO v_id, v_cod;

  RETURN QUERY SELECT v_id, v_cod;
END;
$$;

GRANT EXECUTE ON FUNCTION crear_arrepentimiento(
  text, text, text, text, text, date, text, text, uuid
) TO anon, authenticated;


-- ────────────────────────────────────────────────────────────────
-- 5. VERIFICACION
-- ────────────────────────────────────────────────────────────────
SELECT
  (SELECT count(*) FROM pg_tables   WHERE tablename = 'arrepentimientos') AS tabla,
  (SELECT count(*) FROM pg_policies WHERE tablename = 'arrepentimientos') AS policies,
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'arrepentimientos') AS rls_activo;

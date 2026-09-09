-- ================================================================
--  ARG INDUMENTARIA - Piezas a pedido (venta con link privado)
--
--  Este script se corre SOBRE LA BASE QUE YA EXISTE.
--  (base-desde-cero/setup-supabase.sql es para armar una base nueva;
--   si ya la corriste, no la vuelvas a correr.)
--
--  Supabase Dashboard -> SQL Editor -> New query -> pegar -> Run.
--  Se puede correr mas de una vez sin romper nada.
--
--  QUE HACE
--  Un producto que existe en la base y se puede pagar, pero NO
--  aparece en el catalogo: solo se llega por un link secreto que le
--  mandas vos al cliente que pidio esa pieza. Cierra el circuito del
--  cotizador, que hoy cotiza pero no puede cobrar.
--
--  Ver claude/plan-pieza-a-pedido.md para el plan completo.
-- ================================================================


-- ────────────────────────────────────────────────────────────────
-- 1. COLUMNAS NUEVAS EN products
--
--    Todo lo que ya esta cargado queda en visibilidad='catalogo'
--    por el DEFAULT: este bloque no cambia un solo producto.
-- ────────────────────────────────────────────────────────────────
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS visibilidad    text NOT NULL DEFAULT 'catalogo',
  ADD COLUMN IF NOT EXISTS token          text,
  ADD COLUMN IF NOT EXISTS envio_costo    numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cliente_nombre text,
  ADD COLUMN IF NOT EXISTS cliente_email  text,
  ADD COLUMN IF NOT EXISTS consulta_id    uuid,
  ADD COLUMN IF NOT EXISTS vence_el       timestamptz,
  ADD COLUMN IF NOT EXISTS detalle        text;

COMMENT ON COLUMN public.products.visibilidad IS
  '"catalogo" = se ve en la tienda. "privado" = pieza a pedido, solo por link con token.';
COMMENT ON COLUMN public.products.token IS
  'Los 32 caracteres del link privado. Lo pone solo el trigger, no se carga a mano.';
COMMENT ON COLUMN public.products.envio_costo IS
  'Flete de esta pieza, separado del precio. Ley 24.240: el cliente tiene que verlo discriminado.';
COMMENT ON COLUMN public.products.detalle IS
  'Texto que ve el cliente en la pagina del link: origen, plazo, garantia, que incluye.';

-- El CHECK de visibilidad va aparte: ADD COLUMN IF NOT EXISTS no
-- vuelve a agregarlo en la segunda corrida, pero un CHECK suelto si.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.products'::regclass AND conname = 'products_visibilidad_check'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_visibilidad_check
      CHECK (visibilidad IN ('catalogo', 'privado'));
  END IF;

  -- Una pieza privada sin token seria invisible para siempre: no se
  -- ve en el catalogo y no hay link que la abra. El trigger de abajo
  -- se encarga de que no pase; esto es el cinturon.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.products'::regclass AND conname = 'products_token_privado_check'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_token_privado_check
      CHECK (visibilidad = 'catalogo' OR token IS NOT NULL);
  END IF;

  -- consulta_id engancha con el cotizador. La FK va aparte porque la
  -- tabla consultas puede no existir todavia (parches/consultas.sql).
  IF to_regclass('public.consultas') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conrelid = 'public.products'::regclass AND conname = 'products_consulta_id_fkey'
     ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_consulta_id_fkey
      FOREIGN KEY (consulta_id) REFERENCES public.consultas(id) ON DELETE SET NULL;
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_token
  ON public.products(token) WHERE token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_privadas
  ON public.products(created_at DESC) WHERE visibilidad = 'privado';

CREATE INDEX IF NOT EXISTS idx_products_consulta
  ON public.products(consulta_id) WHERE consulta_id IS NOT NULL;


-- ────────────────────────────────────────────────────────────────
-- 2. EL TOKEN SE GENERA SOLO
--
--    gen_random_uuid() sin los guiones: 32 caracteres hex, 122 bits
--    de azar. Tan imposible de adivinar como un link de pago de
--    Mercado Pago, y sin depender de ninguna extension (uuid-ossp y
--    pgcrypto podrian no estar).
--
--    Que lo haga la base y no el panel es a proposito: asi no hay
--    forma de crear una pieza privada sin link por un descuido del
--    front, y el token nunca viaja en el INSERT.
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_token_pieza_privada()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.visibilidad = 'privado' AND NEW.token IS NULL THEN
    NEW.token := replace(gen_random_uuid()::text, '-', '');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_token ON public.products;
CREATE TRIGGER trg_products_token
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_token_pieza_privada();


-- ────────────────────────────────────────────────────────────────
-- 3. RLS — LA PARTE QUE HACE QUE SEA PRIVADO DE VERDAD
--
--    La policy de lectura publica era USING (true): cualquiera con
--    la clave anon veia toda la tabla. Sin este cambio, "privado"
--    seria solo un filtro del lado del cliente y las cotizaciones se
--    leerian enteras desde la consola del browser.
--
--    products_public es security_invoker=on, asi que hereda esta
--    policy sola. La policy de admins no se toca: vos las seguis
--    viendo todas desde el panel.
-- ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Lectura pública — productos" ON public.products;

CREATE POLICY "Lectura pública — productos"
  ON public.products FOR SELECT
  USING (visibilidad = 'catalogo');


-- ────────────────────────────────────────────────────────────────
-- 4. get_pieza_por_token — como entra el cliente al link
--
--    El visitante anonimo no puede leer la fila (punto 3), asi que
--    entra por aca. Mismo patron que crear_consulta() y
--    get_order_for_payment(): SECURITY DEFINER, una sola puerta.
--
--    Devuelve la fila SOLO si: es privada, el token coincide exacto,
--    y no vencio. Nunca devuelve cost_price. Si no matchea, cero
--    filas — no dice si el token existe o no.
-- ────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_pieza_por_token(text);

CREATE FUNCTION public.get_pieza_por_token(p_token text)
RETURNS TABLE (
  id             uuid,
  title          text,
  price          numeric,
  envio_costo    numeric,
  icon           text,
  image          text,
  images         text[],
  category_id    text,
  subcategory    text,
  brand          text,
  oem            text,
  description    text,
  detalle        text,
  stock          integer,
  cliente_nombre text,
  cliente_email  text,
  vence_el       timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    p.id, p.title, p.price, p.envio_costo, p.icon, p.image, p.images,
    p.category_id, p.subcategory, p.brand, p.oem, p.description, p.detalle,
    p.stock, p.cliente_nombre, p.cliente_email, p.vence_el
  FROM public.products p
  WHERE p.visibilidad = 'privado'
    AND p.token IS NOT NULL
    AND p.token = p_token
    AND (p.vence_el IS NULL OR p.vence_el > now());
$$;

REVOKE ALL ON FUNCTION public.get_pieza_por_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pieza_por_token(text) TO anon, authenticated;


-- ────────────────────────────────────────────────────────────────
-- 5. verificar_precios — tapa un agujero que YA existe hoy
--
--    El checkout verifica los precios contra la base para que nadie
--    manipule el carrito desde el localStorage. Pero lo hacia con un
--    SELECT directo y un fallback:
--
--        priceMap.get(id) ?? i.product.price   <-- el precio del browser
--
--    Con la RLS del punto 3, una pieza privada no volveria nunca de
--    ese SELECT y el checkout usaria el precio del carrito. Esta
--    funcion devuelve el precio real de cualquier producto, privado
--    o no, y el checkout pasa a cortar el pedido si un id no vuelve.
--
--    Devuelve tambien "disponible": una cotizacion vencida que quedo
--    en el carrito tres semanas no se puede pagar.
--    Nunca devuelve cost_price.
-- ────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.verificar_precios(uuid[]);

CREATE FUNCTION public.verificar_precios(p_ids uuid[])
RETURNS TABLE (
  id          uuid,
  title       text,
  price       numeric,
  envio_costo numeric,
  stock       integer,
  disponible  boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    p.id, p.title, p.price, p.envio_costo, COALESCE(p.stock, 0),
    (p.visibilidad = 'catalogo' OR p.vence_el IS NULL OR p.vence_el > now()) AS disponible
  FROM public.products p
  WHERE p.id = ANY(p_ids);
$$;

REVOKE ALL ON FUNCTION public.verificar_precios(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verificar_precios(uuid[]) TO anon, authenticated;


-- ────────────────────────────────────────────────────────────────
-- 6. place_order CON ENVIO
--
--    orders.shipping_cost existe desde el primer dia y nunca se uso:
--    la funcion metia un 0 escrito a mano. Para una pieza que viene
--    de afuera el flete puede ser la mitad del precio.
--
--    OJO — por que DROP y no CREATE OR REPLACE: cambiar la cantidad
--    de parametros crea una funcion NUEVA, y quedarian dos
--    place_order conviviendo. supabase-js llama por nombre de
--    argumento, asi que una llamada con los 11 nombres viejos
--    matchearia las dos y Postgres cortaria con "function is not
--    unique". Hay que sacar la vieja.
--
--    Los permisos no son problema: place_order nunca tuvo GRANT
--    propio, corre con el EXECUTE a PUBLIC que Postgres da por
--    defecto, y eso se restablece solo al recrearla.
-- ────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.place_order(
  text, numeric, numeric, text, text, text, text, text, text, jsonb, uuid);
DROP FUNCTION IF EXISTS public.place_order(
  text, numeric, numeric, text, text, text, text, text, text, jsonb, uuid, numeric);

CREATE FUNCTION public.place_order(
  p_payment_method       text,
  p_subtotal             numeric,
  p_total                numeric,
  p_shipping_name        text,
  p_shipping_address     text,
  p_shipping_city        text,
  p_shipping_province    text,
  p_shipping_postal_code text,
  p_notes                text,
  p_items                jsonb,
  p_user_id              uuid    DEFAULT NULL,
  p_shipping_cost        numeric DEFAULT 0
)
RETURNS TABLE(order_id uuid, order_number text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id    uuid;
  v_num   text;
  v_item  jsonb;
  v_envio numeric := COALESCE(p_shipping_cost, 0);
BEGIN
  IF v_envio < 0 THEN
    RAISE EXCEPTION 'El costo de envio no puede ser negativo.';
  END IF;

  -- El total que se cobra igual sale despues de get_order_for_payment(),
  -- no de esta llamada. Pero si el front manda un total que no cierra
  -- con sus partes, algo esta mal y no queremos guardarlo igual.
  IF round(p_total, 2) <> round(COALESCE(p_subtotal, 0) + v_envio, 2) THEN
    RAISE EXCEPTION 'El total no coincide con subtotal + envio (% <> % + %).',
      p_total, p_subtotal, v_envio;
  END IF;

  INSERT INTO public.orders (
    status, payment_method, payment_status,
    subtotal, shipping_cost, total,
    shipping_name, shipping_address, shipping_city,
    shipping_province, shipping_postal_code, notes,
    user_id
  ) VALUES (
    'pending', p_payment_method, 'pending',
    p_subtotal, v_envio, p_total,
    p_shipping_name, p_shipping_address, p_shipping_city,
    p_shipping_province, p_shipping_postal_code, p_notes,
    p_user_id
  )
  RETURNING id, orders.order_number INTO v_id, v_num;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO public.order_items (order_id, product_id, title, price, icon, image, quantity)
    VALUES (
      v_id,
      (v_item->>'product_id')::uuid,
      v_item->>'title',
      (v_item->>'price')::numeric,
      v_item->>'icon',
      v_item->>'image',
      (v_item->>'quantity')::integer
    );
  END LOOP;

  RETURN QUERY SELECT v_id, v_num;
END;
$function$;


-- ────────────────────────────────────────────────────────────────
-- 7. CONTROL
--    Tiene que dar todo OK. Si algo dice FALTA, el script no termino.
-- ────────────────────────────────────────────────────────────────
SELECT
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_name='products' AND column_name='visibilidad')
       THEN '✅' ELSE '⚠️ FALTA' END                      AS estado,
  'products.visibilidad'                                  AS que
UNION ALL SELECT
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_name='products' AND column_name='envio_costo')
       THEN '✅' ELSE '⚠️ FALTA' END, 'products.envio_costo'
UNION ALL SELECT
  CASE WHEN EXISTS (SELECT 1 FROM pg_policies
                    WHERE tablename='products' AND cmd='SELECT'
                      AND qual LIKE '%catalogo%')
       THEN '✅' ELSE '⚠️ FALTA — las piezas privadas se ven!' END,
  'RLS: lectura publica filtrada'
UNION ALL SELECT
  CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname='get_pieza_por_token')
       THEN '✅' ELSE '⚠️ FALTA' END, 'get_pieza_por_token()'
UNION ALL SELECT
  CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname='verificar_precios')
       THEN '✅' ELSE '⚠️ FALTA' END, 'verificar_precios()'
UNION ALL SELECT
  CASE WHEN EXISTS (SELECT 1 FROM pg_proc
                    WHERE proname='place_order'
                      AND pg_get_function_identity_arguments(oid) LIKE '%p_shipping_cost%')
       THEN '✅' ELSE '⚠️ FALTA' END, 'place_order() con envio'
UNION ALL SELECT
  CASE WHEN (SELECT count(*) FROM pg_proc WHERE proname='place_order') = 1
       THEN '✅' ELSE '⚠️ HAY DOS place_order — el checkout va a fallar' END,
  'una sola place_order';

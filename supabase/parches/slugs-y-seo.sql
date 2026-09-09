-- ================================================================
--  ARG INDUMENTARIA - Direcciones propias para cada producto
--
--  Este script se corre SOBRE LA BASE QUE YA EXISTE.
--  Supabase Dashboard -> SQL Editor -> New query -> pegar -> Run.
--  Se puede correr mas de una vez sin romper nada.
--
--  QUE HACE
--  Le da a cada producto su propia direccion web:
--
--    "Remera oversize de algodon"  ->  /producto/remera-oversize-de-algodon
--
--  Hasta hoy el catalogo entero vivia en "/" y se filtraba del lado del
--  cliente, sin un solo link: para Google el sitio tenia UNA sola pagina.
--  Con esto cada producto es una pagina que se puede indexar, mandar por
--  WhatsApp y compartir.
--
--  Ver claude/plan-pieza-a-pedido.md, seccion 9 ("Lo que este plan NO hace").
-- ================================================================


-- ────────────────────────────────────────────────────────────────
-- 0. FRENO DE MANO
--    Este parche va DESPUES de pedidos-especiales.sql, porque necesita
--    saber cuales productos son privados para no darles direccion.
-- ────────────────────────────────────────────────────────────────
DO $freno$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'visibilidad'
  ) THEN
    RAISE EXCEPTION E'\n\n  ⛔ FALTA UN PASO ANTES.\n'
      '  Corré primero supabase/parches/pedidos-especiales.sql y después este.\n'
      '  (Este script necesita la columna products.visibilidad para no darle\n'
      '   dirección pública a los pedidos especiales.)\n\n'
      '  No se modificó nada.\n';
  END IF;
END
$freno$;


-- ────────────────────────────────────────────────────────────────
-- 1. LA COLUMNA
-- ────────────────────────────────────────────────────────────────
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS slug text;

COMMENT ON COLUMN public.products.slug IS
  'La direccion del producto: /producto/<slug>. La arma sola el trigger al crearlo. '
  'NO se regenera al renombrar el producto, a proposito: cambiarla rompe el link que '
  'Google ya indexo y el que el cliente ya tiene guardado.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_slug
  ON public.products(slug) WHERE slug IS NOT NULL;


-- ────────────────────────────────────────────────────────────────
-- 2. slugify() — el texto a direccion
--
--    Sin depender de la extension unaccent, que en Supabase puede no
--    estar instalada: las vocales con tilde y la ñ se cambian a mano
--    con translate(), que es parte del Postgres de siempre.
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.slugify(p_texto text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT trim(BOTH '-' FROM
    regexp_replace(
      regexp_replace(
        lower(translate(
          COALESCE(p_texto, ''),
          'áàäâãÁÀÄÂÃéèëêÉÈËÊíìïîÍÌÏÎóòöôõÓÒÖÔÕúùüûÚÙÜÛñÑçÇ',
          'aaaaaAAAAAeeeeEEEEiiiiIIIIoooooOOOOOuuuuUUUUnNcC'
        )),
        '[^a-z0-9]+', '-', 'g'    -- todo lo que no sea letra o numero pasa a guion
      ),
      '-{2,}', '-', 'g'            -- y los guiones seguidos se juntan en uno
    )
  );
$$;


-- ────────────────────────────────────────────────────────────────
-- 3. slug_unico_producto() — resuelve los repetidos
--
--    Dos productos se pueden llamar igual. El primero se queda con la
--    direccion linda y los siguientes suman -2, -3, etc.
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.slug_unico_producto(p_base text, p_id uuid)
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_base text := NULLIF(trim(BOTH '-' FROM COALESCE(p_base, '')), '');
  v_slug text;
  v_n    integer := 1;
BEGIN
  -- Un titulo que quede vacio despues de limpiarlo (todo simbolos, o en un
  -- alfabeto que translate() no cubre) igual tiene que poder guardarse.
  IF v_base IS NULL THEN
    v_base := 'producto';
  END IF;

  v_base := left(v_base, 80);
  v_slug := v_base;

  WHILE EXISTS (
    SELECT 1 FROM public.products
    WHERE slug = v_slug AND (p_id IS NULL OR id <> p_id)
  ) LOOP
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  END LOOP;

  RETURN v_slug;
END;
$$;


-- ────────────────────────────────────────────────────────────────
-- 4. EL TRIGGER
--
--    Dos decisiones que valen la pena entender:
--
--    a) Solo se genera si el slug esta VACIO. Renombrar un producto NO
--       le cambia la direccion. Si la cambiara, cada correccion de tipeo
--       en el titulo mataria el link que Google ya indexo y el que el
--       cliente tiene guardado, y Google tendria que empezar de cero con
--       la pagina nueva. Si algun dia hay que cambiarla, se pone el slug
--       en NULL y el trigger la rearma.
--
--    b) Las piezas a pedido (visibilidad='privado') no llevan direccion:
--       se llega a ellas por su token y nada mas. Si una pieza pasara a
--       'catalogo', ahi si se le arma.
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_slug_producto()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.visibilidad = 'catalogo' AND (NEW.slug IS NULL OR NEW.slug = '') THEN
    NEW.slug := public.slug_unico_producto(public.slugify(NEW.title), NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_slug ON public.products;
CREATE TRIGGER trg_products_slug
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_slug_producto();


-- ────────────────────────────────────────────────────────────────
-- 5. LOS QUE YA ESTABAN
--    De a uno y en orden de creacion, para que si hay dos con el mismo
--    nombre el mas viejo se quede con la direccion sin sufijo.
-- ────────────────────────────────────────────────────────────────
DO $backfill$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id, title FROM public.products
    WHERE slug IS NULL AND visibilidad = 'catalogo'
    ORDER BY created_at
  LOOP
    UPDATE public.products
    SET slug = public.slug_unico_producto(public.slugify(r.title), r.id)
    WHERE id = r.id;
  END LOOP;
END
$backfill$;


-- ────────────────────────────────────────────────────────────────
-- 6. CONTROL
-- ────────────────────────────────────────────────────────────────
SELECT
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_name='products' AND column_name='slug')
       THEN '✅' ELSE '⚠️ FALTA' END          AS estado,
  'products.slug'                             AS que
UNION ALL SELECT
  CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname='slugify')
       THEN '✅' ELSE '⚠️ FALTA' END, 'slugify()'
UNION ALL SELECT
  CASE WHEN EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_products_slug')
       THEN '✅' ELSE '⚠️ FALTA' END, 'el trigger que las arma solas'
UNION ALL SELECT
  CASE WHEN NOT EXISTS (SELECT 1 FROM public.products
                        WHERE visibilidad='catalogo' AND (slug IS NULL OR slug=''))
       THEN '✅' ELSE '⚠️ hay productos sin dirección' END,
  'todos los del catálogo tienen dirección'
UNION ALL SELECT
  CASE WHEN NOT EXISTS (SELECT 1 FROM public.products
                        WHERE visibilidad='privado' AND slug IS NOT NULL)
       THEN '✅' ELSE '⚠️ una pieza a pedido quedó con dirección pública' END,
  'las piezas a pedido no tienen dirección';

-- De yapa: cómo quedaron las direcciones
SELECT title AS producto, '/producto/' || slug AS direccion
  FROM public.products
 WHERE visibilidad = 'catalogo'
 ORDER BY created_at
 LIMIT 10;

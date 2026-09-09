-- ════════════════════════════════════════════════════════════════
-- ARG INDUMENTARIA — Columnas que le faltan a la tabla products
-- ════════════════════════════════════════════════════════════════
--
-- Sintoma: al editar un producto desde /admin sale
--   "Could not find the 'cost_price' column of 'products' in the schema cache"
--
-- Motivo: el codigo guarda precio de costo (cost_price), marca (brand) y
-- numero de parte original (oem), pero la base todavia no tiene esas columnas.
--
-- Como se corre: Supabase -> SQL Editor -> New query -> pegar todo -> Run.
-- Es seguro correrlo mas de una vez: si la columna ya existe, no hace nada.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price numeric(12,2) DEFAULT 0 CHECK (cost_price >= 0);
ALTER TABLE products ADD COLUMN IF NOT EXISTS brand text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS oem   text;

-- Los productos que ya estaban cargados quedan con costo 0 (no null),
-- asi el panel de finanzas no se rompe al calcular margenes.
UPDATE products SET cost_price = 0 WHERE cost_price IS NULL;

-- La vista publica se recrea para que incluya brand y oem.
-- Sigue SIN exponer cost_price: el costo es interno, solo lo ve el admin.
DROP VIEW IF EXISTS public.products_public CASCADE;

CREATE VIEW public.products_public
WITH (security_invoker = on) AS
SELECT
  id, title, price, icon, image, images,
  category_id, subcategory, brand, oem, description,
  stock, is_new, is_exclusive, is_outlet,
  created_at, updated_at
FROM products;

GRANT SELECT ON public.products_public TO anon, authenticated;

-- Verificacion: tienen que aparecer las tres filas.
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'products' AND column_name IN ('cost_price','brand','oem')
ORDER BY column_name;

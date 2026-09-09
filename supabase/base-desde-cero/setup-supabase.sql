-- ================================================================
--  ARG INDUMENTARIA - Setup completo de Supabase
--
--  Correr UNA sola vez, sobre un proyecto Supabase RECIEN CREADO:
--  Supabase Dashboard -> SQL Editor -> New Query -> pegar todo -> Run.
--
--  Es la union, en el orden correcto, de los 13 scripts sueltos que
--  estan en la raiz del proyecto. Al terminar deberias ver los 11
--  rubros de autopartes en Table Editor -> categories y los 23
--  repuestos de arranque en Table Editor -> products.
--
--  DESPUES de este script, para poder entrar al panel admin, hay que
--  correr crear-admin.sql (ver instrucciones dentro de ese archivo).
-- ================================================================



-- ================================================================
-- >>> supabase_schema.sql
--     Esquema base: productos, rubros, pedidos, admin_users, RLS
-- ================================================================

-- ================================================================
--  ARG INDUMENTARIA — Schema completo Supabase
--  Ejecutar en: Supabase Dashboard → SQL Editor → New Query
-- ================================================================


-- ────────────────────────────────────────────────────────────────
-- 0. EXTENSIONES
-- ────────────────────────────────────────────────────────────────
-- ────────────────────────────────────────────────────────────────
-- FRENO DE MANO: este script es SÓLO para una base nueva y vacía.
-- Si la base ya existe, se cortaba con "relation categories already
-- exists", que no dice nada. Ahora avisa qué hay que correr en su lugar.
-- ────────────────────────────────────────────────────────────────
DO $freno$
BEGIN
  IF to_regclass('public.categories') IS NOT NULL THEN
    RAISE EXCEPTION E'\n\n  ⛔ ESTA BASE YA EXISTE — no corras setup-supabase.sql.\n'
      '  Este script arma la base desde cero y sólo sirve en un proyecto nuevo y vacío.\n\n'
      '  Lo que buscabas es alguno de los parches de la carpeta supabase/:\n'
      '    · rubros-2026-09.sql  → pasa el catálogo a 15 rubros y 84 subrubros\n'
      '    · chequeo.sql         → te dice qué scripts te faltan correr (no cambia nada)\n\n'
      '  No se modificó nada.\n';
  END IF;
END
$freno$;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ────────────────────────────────────────────────────────────────
-- 1. CATEGORÍAS
-- ────────────────────────────────────────────────────────────────
CREATE TABLE categories (
  id          text PRIMARY KEY,          -- slug: "motor", "frenos", etc.
  name        text        NOT NULL,
  sort_order  integer     DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

-- ────────────────────────────────────────────────────────────────
-- 2. SUBCATEGORÍAS
-- ────────────────────────────────────────────────────────────────
CREATE TABLE subcategories (
  id          uuid  DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id text  NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name        text  NOT NULL,
  sort_order  integer DEFAULT 0
);

-- ────────────────────────────────────────────────────────────────
-- 3. ESPECIALES (Exclusivos / Novedades / Outlet)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE especiales (
  id          text PRIMARY KEY,          -- "exclusivos", "novedades", "outlet"
  name        text NOT NULL,
  sort_order  integer DEFAULT 0
);

-- ────────────────────────────────────────────────────────────────
-- 4. PRODUCTOS
-- ────────────────────────────────────────────────────────────────
CREATE TABLE products (
  id           uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  title        text    NOT NULL,
  price        numeric(12,2) NOT NULL CHECK (price >= 0),
  cost_price   numeric(12,2) DEFAULT 0 CHECK (cost_price >= 0),  -- costo interno, solo admin
  icon         text    DEFAULT '📦',
  image        text,                      -- URL imagen principal
  images       text[], -- array de URLs para galería
  category_id  text    REFERENCES categories(id) ON DELETE SET NULL,
  subcategory  text,
  brand        text,                      -- marca del repuesto (Bosch, Brembo...)
  oem          text,                      -- numero de parte original
  description  text,
  stock        integer DEFAULT 0 CHECK (stock >= 0),
  is_new       boolean DEFAULT false,
  is_exclusive boolean DEFAULT false,
  is_outlet    boolean DEFAULT false,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

-- ────────────────────────────────────────────────────────────────
-- 5. CONFIGURACIÓN DEL SITIO
-- ────────────────────────────────────────────────────────────────
CREATE TABLE site_settings (
  id                  integer PRIMARY KEY DEFAULT 1,   -- solo 1 fila
  site_name           text DEFAULT 'ARG INDUMENTARIA',
  banner_text         text DEFAULT 'REPUESTOS . MOTOR . RUTA',
  email               text DEFAULT 'ventas@argindumentaria.com.ar',
  phone               text DEFAULT '+54 9 351 000-0000',
  whatsapp            text DEFAULT '+54 9 351 000-0000',
  instagram           text DEFAULT '@arg.indumentaria',
  facebook            text DEFAULT 'argindumentaria',
  envios_desc         text DEFAULT 'Envíos a todo el país por Correo Argentino, OCA y Andreani',
  free_shipping_min   numeric(12,2) DEFAULT 50000,
  currency            text DEFAULT 'ARS',
  updated_at          timestamptz DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- ────────────────────────────────────────────────────────────────
-- 6. CLIENTES
-- ────────────────────────────────────────────────────────────────
CREATE TABLE customers (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name         text NOT NULL,
  email        text UNIQUE NOT NULL,
  phone        text,
  address      text,
  city         text,
  province     text,
  postal_code  text,
  created_at   timestamptz DEFAULT now()
);

-- ────────────────────────────────────────────────────────────────
-- 7. PEDIDOS
-- ────────────────────────────────────────────────────────────────

-- Secuencia para número de pedido legible: AG-000001
CREATE SEQUENCE order_number_seq START 1;

CREATE TABLE orders (
  id                   uuid   DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number         text   DEFAULT ('AG-' || LPAD(nextval('order_number_seq')::text, 6, '0')) UNIQUE,
  customer_id          uuid   REFERENCES customers(id) ON DELETE SET NULL,

  -- Estado del pedido
  status               text   DEFAULT 'pending'
                              CHECK (status IN ('pending','confirmed','processing','shipped','delivered','cancelled')),

  -- Totales
  subtotal             numeric(12,2) NOT NULL DEFAULT 0,
  shipping_cost        numeric(12,2) NOT NULL DEFAULT 0,
  total                numeric(12,2) NOT NULL DEFAULT 0,

  -- Pago
  payment_method       text,                 -- "transferencia", "mercadopago", "efectivo", etc.
  payment_status       text   DEFAULT 'pending'
                              CHECK (payment_status IN ('pending','paid','failed','refunded')),
  payment_reference    text,                 -- ID transacción MercadoPago, etc.

  -- Envío
  shipping_name        text,
  shipping_address     text,
  shipping_city        text,
  shipping_province    text,
  shipping_postal_code text,

  notes                text,
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

-- ────────────────────────────────────────────────────────────────
-- 8. ITEMS DE PEDIDO
-- ────────────────────────────────────────────────────────────────
CREATE TABLE order_items (
  id          uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id    uuid    NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id  uuid    REFERENCES products(id) ON DELETE SET NULL,

  -- Snapshot al momento de la compra (precio puede cambiar después)
  title       text    NOT NULL,
  price       numeric(12,2) NOT NULL,
  icon        text,
  image       text,
  quantity    integer NOT NULL CHECK (quantity > 0),
  subtotal    numeric(12,2) GENERATED ALWAYS AS (price * quantity) STORED
);

-- ────────────────────────────────────────────────────────────────
-- 9. ADMINISTRADORES
-- ────────────────────────────────────────────────────────────────
CREATE TABLE admin_users (
  id         uuid  PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      text  NOT NULL,
  name       text,
  role       text  DEFAULT 'admin'
                   CHECK (role IN ('superadmin', 'admin', 'editor')),
  created_at timestamptz DEFAULT now()
);


-- ================================================================
-- TRIGGERS — updated_at automático
-- ================================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_settings_updated_at
  BEFORE UPDATE ON site_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ================================================================
-- ÍNDICES
-- ================================================================
CREATE INDEX idx_products_category_id  ON products(category_id);
CREATE INDEX idx_products_subcategory  ON products(subcategory);
CREATE INDEX idx_products_is_new       ON products(is_new)       WHERE is_new = true;
CREATE INDEX idx_products_is_exclusive ON products(is_exclusive) WHERE is_exclusive = true;
CREATE INDEX idx_products_is_outlet    ON products(is_outlet)    WHERE is_outlet = true;
CREATE INDEX idx_products_stock        ON products(stock);
CREATE INDEX idx_order_items_order_id  ON order_items(order_id);
CREATE INDEX idx_orders_customer_id    ON orders(customer_id);
CREATE INDEX idx_orders_status         ON orders(status);
CREATE INDEX idx_orders_created_at     ON orders(created_at DESC);
CREATE INDEX idx_subcats_category_id   ON subcategories(category_id);


-- ================================================================
-- VISTAS — para el panel de finanzas y pedidos
-- ================================================================

-- Vista: pedidos con datos del cliente e items
CREATE OR REPLACE VIEW orders_overview AS
SELECT
  o.id,
  o.order_number,
  o.status,
  o.payment_status,
  o.payment_method,
  o.total,
  o.created_at,
  o.updated_at,
  c.name        AS customer_name,
  c.email       AS customer_email,
  c.phone       AS customer_phone,
  (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count
FROM orders o
LEFT JOIN customers c ON c.id = o.customer_id;

-- Vista: revenue mensual (para página de finanzas)
CREATE OR REPLACE VIEW revenue_by_month AS
SELECT
  DATE_TRUNC('month', created_at) AS month,
  COUNT(*)                         AS total_orders,
  SUM(total)                       AS revenue,
  AVG(total)                       AS avg_ticket,
  SUM(CASE WHEN status = 'delivered' THEN total ELSE 0 END) AS revenue_delivered,
  SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END)     AS cancelled_count
FROM orders
WHERE payment_status = 'paid'
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY month DESC;

-- Vista: productos con stock bajo (para alertas en admin)
CREATE OR REPLACE VIEW low_stock_products AS
SELECT
  p.id,
  p.title,
  p.stock,
  p.price,
  c.name AS category_name
FROM products p
LEFT JOIN categories c ON c.id = p.category_id
WHERE p.stock <= 3
ORDER BY p.stock ASC;


-- ================================================================
-- ROW LEVEL SECURITY (RLS)
-- ================================================================
ALTER TABLE categories     ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcategories  ENABLE ROW LEVEL SECURITY;
ALTER TABLE especiales     ENABLE ROW LEVEL SECURITY;
ALTER TABLE products       ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders         ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users    ENABLE ROW LEVEL SECURITY;

-- Helper: verifica si el usuario autenticado es admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_users WHERE id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper: verifica si es superadmin
CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_users WHERE id = auth.uid() AND role = 'superadmin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- ── Lectura pública (catálogo de la tienda) ──────────────────────
CREATE POLICY "Lectura pública — categorías"
  ON categories FOR SELECT USING (true);

CREATE POLICY "Lectura pública — subcategorías"
  ON subcategories FOR SELECT USING (true);

CREATE POLICY "Lectura pública — especiales"
  ON especiales FOR SELECT USING (true);

CREATE POLICY "Lectura pública — productos"
  ON products FOR SELECT USING (true);

CREATE POLICY "Lectura pública — configuración"
  ON site_settings FOR SELECT USING (true);

-- ── Escritura solo admins ────────────────────────────────────────
CREATE POLICY "Admins gestionan productos"
  ON products FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins gestionan categorías"
  ON categories FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins gestionan subcategorías"
  ON subcategories FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins gestionan especiales"
  ON especiales FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins actualizan configuración"
  ON site_settings FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ── Clientes ─────────────────────────────────────────────────────
CREATE POLICY "Cualquiera puede crear cliente"
  ON customers FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins ven todos los clientes"
  ON customers FOR SELECT USING (is_admin());

CREATE POLICY "Admins actualizan clientes"
  ON customers FOR UPDATE USING (is_admin());

-- ── Pedidos ──────────────────────────────────────────────────────
CREATE POLICY "Cualquiera puede crear pedido"
  ON orders FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins ven todos los pedidos"
  ON orders FOR SELECT USING (is_admin());

CREATE POLICY "Admins actualizan pedidos"
  ON orders FOR UPDATE USING (is_admin());

-- ── Items de pedido ──────────────────────────────────────────────
CREATE POLICY "Cualquiera puede insertar items"
  ON order_items FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins ven items de pedidos"
  ON order_items FOR SELECT USING (is_admin());

-- ── Admins ───────────────────────────────────────────────────────
CREATE POLICY "Admins se ven a sí mismos"
  ON admin_users FOR SELECT
  USING (id = auth.uid() OR is_superadmin());

CREATE POLICY "Solo superadmin gestiona admins"
  ON admin_users FOR ALL
  USING (is_superadmin())
  WITH CHECK (is_superadmin());


-- ================================================================
-- DATOS INICIALES
-- ================================================================

-- Configuración del sitio (1 sola fila)
INSERT INTO site_settings (id) VALUES (1);

-- Los rubros, subrubros y el catálogo de arranque los carga
-- seed-argarage.sql, que corre más adelante en este mismo script.

-- Especiales
INSERT INTO especiales (id, name, sort_order) VALUES
  ('exclusivos', 'ZONA EXCLUSIVOS',      1),
  ('novedades',  'NOVEDADES',            2),
  ('outlet',     'OUTLET / LIQUIDACIÓN', 3);

-- ================================================================
-- STORAGE — Bucket para imágenes de productos
-- (Ejecutar en SQL Editor de Supabase)
-- ================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('products', 'products', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Imágenes públicas"     ON storage.objects;
DROP POLICY IF EXISTS "Admins suben imágenes"    ON storage.objects;
DROP POLICY IF EXISTS "Admins eliminan imágenes" ON storage.objects;

-- Política: lectura pública de imágenes
CREATE POLICY "Imágenes públicas"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'products');

-- Política: solo admins suben/borran imágenes
CREATE POLICY "Admins suben imágenes"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'products' AND is_admin());

CREATE POLICY "Admins eliminan imágenes"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'products' AND is_admin());


-- ================================================================
-- PRIMER SUPERADMIN
-- Reemplazá el UUID con el de tu usuario en Authentication > Users
-- ================================================================
-- No hace falta hacerlo a mano: crear-admin.sql toma el id del usuario
-- que creaste en Authentication buscándolo por email.


-- ================================================================
-- RESUMEN DE TABLAS CREADAS
-- ================================================================
-- categories      → Rubros del catálogo (motor, frenos, suspensión…)
-- subcategories   → Subcategorías de cada categoría
-- especiales      → Secciones especiales (exclusivos, novedades, outlet)
-- products        → Catálogo de productos con stock, badges e imágenes
-- site_settings   → Configuración global del sitio (1 sola fila)
-- customers       → Clientes que realizaron pedidos
-- orders          → Pedidos con número legible AG-000001
-- order_items     → Líneas de cada pedido (snapshot de precio/título)
-- admin_users     → Usuarios admin vinculados a Supabase Auth
--
-- VISTAS:
-- orders_overview     → Pedidos + cliente + cantidad de items
-- revenue_by_month    → Ingresos agrupados por mes (para finanzas)
-- low_stock_products  → Productos con stock <= 3 (alertas admin)
--
-- STORAGE:
-- bucket "products"   → Imágenes de productos, acceso público
-- ================================================================


-- ================================================================
-- >>> supabase_user_profiles.sql
--     Perfiles de usuario y vinculo con auth.users
-- ================================================================

-- ================================================================
--  ARG INDUMENTARIA — Perfiles de usuario + vincular pedidos al auth
--  Ejecutar en: Supabase Dashboard → SQL Editor → New Query
-- ================================================================


-- ────────────────────────────────────────────────────────────────
-- 1. TABLA user_profiles
--    Vinculada a auth.users. Una fila por usuario registrado.
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_profiles (
  id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name     text,
  phone         text,
  dni           text,                   -- DNI / CUIL

  -- Dirección de envío principal
  address_street       text,
  address_neighborhood text,               -- Barrio
  address_city         text,
  address_province     text,
  address_zip          text,

  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- Auto-actualizar updated_at
CREATE OR REPLACE FUNCTION update_user_profile_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_user_profiles_updated
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_user_profile_timestamp();

-- Crear perfil vacío automáticamente cuando un usuario se registra
CREATE OR REPLACE FUNCTION create_user_profile_on_signup()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_create_profile_on_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_user_profile_on_signup();


-- ────────────────────────────────────────────────────────────────
-- 2. VINCULAR PEDIDOS AL USUARIO AUTH
--    Agrega user_id a orders para que cada cliente pueda ver
--    sus propios pedidos.
-- ────────────────────────────────────────────────────────────────
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);


-- ────────────────────────────────────────────────────────────────
-- 3. RLS — user_profiles
-- ────────────────────────────────────────────────────────────────
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Cada usuario solo puede ver y editar su propio perfil
CREATE POLICY "user_profiles_select_own" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "user_profiles_insert_own" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "user_profiles_update_own" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- Admin puede ver todos los perfiles
CREATE POLICY "user_profiles_admin_all" ON user_profiles
  FOR ALL USING (is_admin());


-- ────────────────────────────────────────────────────────────────
-- 4. RLS — orders: el usuario ve solo sus pedidos
-- ────────────────────────────────────────────────────────────────
-- (Si ya existe una política en orders, ajustar o eliminar primero)
DROP POLICY IF EXISTS "orders_select_own" ON orders;
CREATE POLICY "orders_select_own" ON orders
  FOR SELECT USING (auth.uid() = user_id OR is_admin());


-- ────────────────────────────────────────────────────────────────
-- 5. VISTA: pedidos del cliente con items resumidos
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW customer_orders AS
SELECT
  o.id,
  o.order_number,
  o.status,
  o.payment_status,
  o.total,
  o.created_at,
  o.user_id,
  COALESCE(
    json_agg(
      json_build_object(
        'title',    oi.title,
        'quantity', oi.quantity,
        'price',    oi.price,
        'image',    oi.image
      )
    ) FILTER (WHERE oi.id IS NOT NULL),
    '[]'
  ) AS items
FROM orders o
LEFT JOIN order_items oi ON oi.order_id = o.id
GROUP BY o.id;


-- ================================================================
-- >>> supabase_clientes.sql
--     Gestion de clientes desde el panel admin
-- ================================================================

-- ================================================================
--  ARG INDUMENTARIA — Gestión de clientes desde el panel admin
--  Ejecutar en: Supabase Dashboard → SQL Editor → New Query
-- ================================================================


-- ────────────────────────────────────────────────────────────────
-- 1. Agregar columna status a user_profiles (si no existe)
-- ────────────────────────────────────────────────────────────────
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active'
  CHECK (status IN ('active', 'cancelled'));

-- Barrio: lo usa el formulario de clientes del panel y la vista
-- admin_clients_view. En bases viejas puede no existir todavía.
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS address_neighborhood text;


-- ────────────────────────────────────────────────────────────────
-- 2. Vista para el admin: une user_profiles + auth.users
--    Permite ver el email de cada cliente desde el panel
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW admin_clients_view AS
SELECT
  p.id,
  u.email,
  p.full_name,
  p.phone,
  p.dni,
  p.address_street,
  p.address_city,
  p.address_province,
  p.address_zip,
  p.status,
  p.created_at
FROM user_profiles p
JOIN auth.users u ON u.id = p.id;

-- Solo admins pueden leer la vista
REVOKE ALL ON admin_clients_view FROM anon, authenticated;
GRANT SELECT ON admin_clients_view TO authenticated;

-- Política RLS adicional: admin puede leer TODOS los perfiles
-- (ya existe "user_profiles_admin_all" del script anterior,
--  si no existe, crearla:)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_profiles' AND policyname = 'user_profiles_admin_all'
  ) THEN
    CREATE POLICY "user_profiles_admin_all" ON user_profiles
      FOR ALL USING (is_admin());
  END IF;
END $$;


-- ================================================================
-- >>> security-patch.sql
--     decrement_stock con bloqueo de fila y demas parches
-- ================================================================

-- ================================================================
--  ARG INDUMENTARIA — Security Patch (v2 — corregido)
--  Ejecutar en: Supabase Dashboard → SQL Editor → New Query
-- ================================================================


-- ────────────────────────────────────────────────────────────────
-- 1. decrement_stock — con bloqueo de fila y verificación de stock
--    Previene: stock negativo + race conditions entre pedidos
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION decrement_stock(p_product_id uuid, p_qty integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stock integer;
BEGIN
  SELECT stock INTO v_stock
  FROM products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Producto no encontrado: %', p_product_id;
  END IF;

  IF v_stock < p_qty THEN
    RAISE EXCEPTION 'Stock insuficiente. Disponible: %, solicitado: %', v_stock, p_qty;
  END IF;

  UPDATE products
  SET stock      = stock - p_qty,
      updated_at = now()
  WHERE id = p_product_id;
END;
$$;


-- ────────────────────────────────────────────────────────────────
-- 2. check_order_rate_limit — máx. 5 pedidos por email en 24 h
--    Previene: spam de pedidos falsos
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION check_order_rate_limit(p_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COUNT(*) < 5
  FROM orders
  WHERE notes ILIKE '%Email: ' || p_email || '%'
    AND created_at > NOW() - INTERVAL '24 hours';
$$;


-- ────────────────────────────────────────────────────────────────
-- 3. get_product_stock — lectura atómica de stock disponible
--    Usada en checkout para verificar antes de procesar el pedido
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_product_stock(p_product_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(stock, 0)
  FROM products
  WHERE id = p_product_id;
$$;


-- ────────────────────────────────────────────────────────────────
-- 4. Vista pública de productos (sin cost_price)
--    cost_price ya se excluye en el código TypeScript,
--    esta vista es una segunda capa de protección
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW products_public AS
SELECT
  id, title, price, icon, image, images,
  category_id, subcategory, brand, oem, description,
  stock, is_new, is_exclusive, is_outlet,
  created_at, updated_at
FROM products;


-- ────────────────────────────────────────────────────────────────
-- 5. Índice para acelerar queries de rate limit
-- ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_orders_notes_created
  ON orders(created_at DESC, notes);


-- ────────────────────────────────────────────────────────────────
-- VERIFICACIÓN — correr después del patch:
-- ────────────────────────────────────────────────────────────────
-- SELECT routine_name FROM information_schema.routines
-- WHERE routine_schema = 'public'
--   AND routine_name IN ('decrement_stock','check_order_rate_limit','get_product_stock');
-- → Debe devolver 3 filas
-- ================================================================


-- ================================================================
-- >>> fix-categorias-rls.sql
--     Permisos de escritura sobre rubros y subrubros
-- ================================================================

-- ================================================================
--  FIX: Asegurar permisos INSERT/UPDATE/DELETE en categories
--  Ejecutar en: Supabase Dashboard → SQL Editor → New Query
-- ================================================================

-- Re-crear política ALL para categorías (por si no existía o falló)
DROP POLICY IF EXISTS "Admins gestionan categorías"    ON categories;
DROP POLICY IF EXISTS "Admins gestionan subcategorías" ON subcategories;

CREATE POLICY "Admins gestionan categorías"
  ON categories FOR ALL
  USING    (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins gestionan subcategorías"
  ON subcategories FOR ALL
  USING    (is_admin())
  WITH CHECK (is_admin());

-- Verificación: debés ver tu user_id listado aquí
-- SELECT id, email, role FROM admin_users;


-- ================================================================
-- >>> fix-orders-policy.sql
--     Politicas RLS de pedidos (checkout invitado y logueado)
-- ================================================================

-- ================================================================
--  FIX COMPLETO: permisos + políticas RLS para orders/order_items
--  Ejecutar en: Supabase Dashboard → SQL Editor → New Query
-- ================================================================

-- 1. Otorgar permisos de INSERT al rol anon y authenticated
GRANT INSERT ON public.orders      TO anon, authenticated;
GRANT INSERT ON public.order_items TO anon, authenticated;
GRANT SELECT ON public.orders      TO anon, authenticated;
GRANT SELECT ON public.order_items TO anon, authenticated;

-- 2. Recrear políticas INSERT
DROP POLICY IF EXISTS "Cualquiera puede crear pedido"  ON public.orders;
DROP POLICY IF EXISTS "Pedidos con rate limit"         ON public.orders;

CREATE POLICY "Cualquiera puede crear pedido"
  ON public.orders FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Cualquiera puede insertar items" ON public.order_items;

CREATE POLICY "Cualquiera puede insertar items"
  ON public.order_items FOR INSERT
  WITH CHECK (true);

-- 3. Verificación — descomentar y correr para confirmar:
-- SELECT grantee, table_name, privilege_type
-- FROM information_schema.role_table_grants
-- WHERE table_name IN ('orders','order_items')
--   AND privilege_type = 'INSERT'
--   AND grantee IN ('anon','authenticated');
-- → Debe devolver 4 filas
-- ================================================================


-- ================================================================
-- >>> fix-place-order-user-id.sql
--     place_order() guarda el user_id del comprador
-- ================================================================

-- ================================================================
--  Fix: place_order() nunca guardaba orders.user_id, por eso
--  orders_overview (que junta con user_profiles por user_id) siempre
--  mostraba el nombre del cliente vacío, tanto para invitados como
--  para usuarios logueados.
--
--  Este cambio agrega un parámetro opcional p_user_id (con DEFAULT
--  NULL, así los checkouts de invitados que no lo manden siguen
--  funcionando igual) y lo guarda en la fila de orders.
--
--  Correr en: Supabase Dashboard → SQL Editor → New Query
-- ================================================================

CREATE OR REPLACE FUNCTION public.place_order(
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
  p_user_id              uuid DEFAULT NULL
)
RETURNS TABLE(order_id uuid, order_number text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id  uuid;
  v_num text;
  v_item jsonb;
BEGIN
  INSERT INTO public.orders (
    status, payment_method, payment_status,
    subtotal, shipping_cost, total,
    shipping_name, shipping_address, shipping_city,
    shipping_province, shipping_postal_code, notes,
    user_id
  ) VALUES (
    'pending', p_payment_method, 'pending',
    p_subtotal, 0, p_total,
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

-- Restaurar el search_path fijo (buena práctica de seguridad ya aplicada antes)
ALTER FUNCTION public.place_order(
  text, numeric, numeric, text, text, text, text, text, text, jsonb, uuid
) SET search_path = public;


-- ================================================================
-- >>> add-reviews-table.sql
--     Tabla de resenas y su circuito de moderacion
-- ================================================================

-- ================================================================
--  Reseñas de clientes — circuito completo
--
--  Flujo:
--   1. Cliente compra y el pedido llega a status = 'delivered'.
--   2. Desde "Mi Cuenta > Mis Compras" puede dejar UNA reseña
--      (estrellas + texto) por ese pedido.
--   3. La reseña entra con status = 'pending' (no se muestra
--      públicamente todavía).
--   4. El admin desde /admin/resenas puede pasarla a 'verified'
--      (se muestra en la home, sección "Lo que dicen nuestros
--      clientes"), a 'blocked' (se oculta pero no se borra) o
--      eliminarla directamente.
--   5. Si no hay ninguna reseña 'verified', la home sigue mostrando
--      los testimonios mock de siempre (fallback, ver Testimonials.tsx).
--
--  Correr en: Supabase Dashboard → SQL Editor → New Query
-- ================================================================

CREATE TABLE IF NOT EXISTS public.reviews (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id      uuid        NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id       uuid        NOT NULL REFERENCES auth.users(id)    ON DELETE CASCADE,
  customer_name text        NOT NULL,
  stars         smallint    NOT NULL CHECK (stars BETWEEN 1 AND 5),
  body          text        NOT NULL CHECK (char_length(trim(body)) > 0),
  status        text        NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'verified', 'blocked')),
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),

  -- Un solo review por pedido
  UNIQUE (order_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON public.reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_status  ON public.reviews(status);

-- updated_at automático
CREATE OR REPLACE FUNCTION public.set_reviews_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_reviews_updated_at ON public.reviews;
CREATE TRIGGER trg_reviews_updated_at
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_reviews_updated_at();

-- ────────────────────────────────────────────────────────────────
-- RLS
-- ────────────────────────────────────────────────────────────────
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

GRANT SELECT                   ON public.reviews TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE   ON public.reviews TO authenticated;

-- Lectura: cualquiera ve las verificadas (home pública); el dueño
-- ve también las propias sea cual sea su estado; los admins ven todo.
-- (is_admin() ya existe en el proyecto — helper SECURITY DEFINER que
-- chequea admin_users, usado por las policies de orders/order_items).
DROP POLICY IF EXISTS "reviews_select" ON public.reviews;
CREATE POLICY "reviews_select"
  ON public.reviews FOR SELECT
  USING (
    status = 'verified'
    OR user_id = auth.uid()
    OR is_admin()
  );

-- Insert: solo el dueño del pedido, y solo si el pedido es suyo y
-- está en estado 'delivered'. Siempre entra como 'pending'.
DROP POLICY IF EXISTS "reviews_insert_own" ON public.reviews;
CREATE POLICY "reviews_insert_own"
  ON public.reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'pending'
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id
        AND o.user_id = auth.uid()
        AND o.status = 'delivered'
    )
  );

-- Update: solo admins (para verificar/bloquear).
DROP POLICY IF EXISTS "reviews_update_admin" ON public.reviews;
CREATE POLICY "reviews_update_admin"
  ON public.reviews FOR UPDATE
  TO authenticated
  USING     (is_admin())
  WITH CHECK (is_admin());

-- Delete: solo admins.
DROP POLICY IF EXISTS "reviews_delete_admin" ON public.reviews;
CREATE POLICY "reviews_delete_admin"
  ON public.reviews FOR DELETE
  TO authenticated
  USING (is_admin());

-- ────────────────────────────────────────────────────────────────
-- VERIFICACIÓN — correr después de crear todo:
-- ────────────────────────────────────────────────────────────────
-- SELECT tablename, policyname FROM pg_policies WHERE tablename = 'reviews';
-- → Debe devolver 4 políticas (select, insert_own, update_admin, delete_admin)
-- ================================================================


-- ================================================================
-- >>> fix-security-definer-views.sql
--     Vistas sin SECURITY DEFINER (Security Advisor)
-- ================================================================

-- ================================================================
--  ARG INDUMENTARIA — Fix real: Supabase Security Advisor
--  Basado en las definiciones LIVE (confirmadas por diagnóstico),
--  no en los .sql viejos del repo (que ya no coinciden).
--
--  Resuelve:
--    0002 auth_users_exposed    → orders_overview, admin_clients_view
--    0010 security_definer_view → las 6 vistas
--
--  Estrategia:
--  1) Estas vistas dependían de JOIN directo a auth.users, expuesto
--     a través de GRANT a "anon"/"authenticated" sin invocar RLS real
--     (security_invoker apagado = corren con permisos del dueño).
--  2) En vez de solo prender security_invoker (eso rompería el panel
--     admin, porque "authenticated" nunca tiene permiso para leer
--     auth.users), sacamos el join a auth.users del todo: el email
--     pasa a vivir en user_profiles (columna propia, sincronizada
--     por el trigger de alta de usuario).
--  3) Las vistas de admin quedan con WHERE is_admin() + security_invoker
--     + grants acotados a "authenticated" (nada de "anon").
--  4) products_public sigue pública a propósito (catálogo de la tienda).
--
--  Ejecutar en: Supabase Dashboard → SQL Editor → New Query
-- ================================================================


-- ────────────────────────────────────────────────────────────────
-- 0. user_profiles: agregar columna email propia (sin depender de
--    join a auth.users nunca más en vistas expuestas a PostgREST)
-- ────────────────────────────────────────────────────────────────
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS email text;

-- Backfill: correr una sola vez (usa auth.users, permitido acá
-- porque este SQL Editor corre como postgres/superuser)
UPDATE user_profiles p
SET email = u.email
FROM auth.users u
WHERE u.id = p.id
  AND p.email IS DISTINCT FROM u.email;

-- Mantenerlo sincronizado en altas nuevas
CREATE OR REPLACE FUNCTION create_user_profile_on_signup()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, full_name, email)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.email)
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  RETURN NEW;
END;
$$;

-- Mantenerlo sincronizado si el usuario cambia el email en Supabase Auth
CREATE OR REPLACE FUNCTION sync_user_profile_email()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.user_profiles SET email = NEW.email WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_email ON auth.users;
CREATE TRIGGER trg_sync_profile_email
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION sync_user_profile_email();


-- ────────────────────────────────────────────────────────────────
-- 1. admin_clients_view — ya NO joinea auth.users. Filtra por
--    is_admin() adentro de la vista (además de RLS via security_invoker).
--    DROP primero: el tipo de "email" cambia (varchar(255) → text),
--    y CREATE OR REPLACE VIEW no permite cambiar tipos de columna.
-- ────────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS public.admin_clients_view CASCADE;

CREATE VIEW public.admin_clients_view
WITH (security_invoker = on) AS
SELECT
  p.id,
  p.email,
  p.full_name,
  p.phone,
  p.dni,
  p.address_street,
  p.address_neighborhood,
  p.address_city,
  p.address_province,
  p.address_zip,
  p.status,
  p.created_at
FROM user_profiles p
WHERE is_admin();

REVOKE ALL ON public.admin_clients_view FROM anon, authenticated;
GRANT SELECT ON public.admin_clients_view TO authenticated;


-- ────────────────────────────────────────────────────────────────
-- 2. orders_overview — mismo criterio: user_profiles en vez de
--    auth.users, admin-only. DROP primero por el mismo motivo
--    (customer_email cambia de tipo).
-- ────────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS public.orders_overview CASCADE;

CREATE VIEW public.orders_overview
WITH (security_invoker = on) AS
SELECT
  o.id,
  o.order_number,
  o.status,
  o.payment_status,
  o.payment_method,
  o.total,
  o.created_at,
  o.updated_at,
  p.full_name AS customer_name,
  p.email     AS customer_email,
  p.phone     AS customer_phone,
  count(oi.id) AS item_count
FROM orders o
LEFT JOIN user_profiles p ON p.id = o.user_id
LEFT JOIN order_items oi ON oi.order_id = o.id
WHERE is_admin()
GROUP BY o.id, p.full_name, p.email, p.phone;

REVOKE ALL ON public.orders_overview FROM anon, authenticated;
GRANT SELECT ON public.orders_overview TO authenticated;


-- ────────────────────────────────────────────────────────────────
-- 3. revenue_by_month — admin-only (finanzas)
-- ────────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS public.revenue_by_month CASCADE;

CREATE VIEW public.revenue_by_month
WITH (security_invoker = on) AS
SELECT
  date_trunc('month', created_at)::date AS month,
  sum(total) FILTER (WHERE status <> 'cancelled')   AS revenue,
  count(*)   FILTER (WHERE status <> 'cancelled')   AS total_orders,
  avg(total) FILTER (WHERE status <> 'cancelled')   AS avg_ticket,
  count(*)   FILTER (WHERE status = 'cancelled')    AS cancelled_count
FROM orders
WHERE is_admin()
GROUP BY date_trunc('month', created_at)
ORDER BY date_trunc('month', created_at) DESC;

REVOKE ALL ON public.revenue_by_month FROM anon, authenticated;
GRANT SELECT ON public.revenue_by_month TO authenticated;


-- ────────────────────────────────────────────────────────────────
-- 4. low_stock_products — admin-only (alertas de stock)
-- ────────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS public.low_stock_products CASCADE;

CREATE VIEW public.low_stock_products
WITH (security_invoker = on) AS
SELECT
  p.id,
  p.title,
  p.stock,
  p.price,
  c.name AS category_name
FROM products p
LEFT JOIN categories c ON c.id = p.category_id
WHERE p.stock <= 3
  AND is_admin()
ORDER BY p.stock;

REVOKE ALL ON public.low_stock_products FROM anon, authenticated;
GRANT SELECT ON public.low_stock_products TO authenticated;


-- ────────────────────────────────────────────────────────────────
-- 5. customer_orders — "Mis compras" del cliente logueado.
--    security_invoker=on hace que ahora sí se respete la RLS real
--    de "orders" (cada uno ve solo lo suyo). Para que los items
--    también se vean, hace falta una policy de SELECT propia en
--    order_items (antes solo existía para admins).
-- ────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'order_items' AND policyname = 'order_items_select_own'
  ) THEN
    CREATE POLICY "order_items_select_own" ON order_items
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM orders o
          WHERE o.id = order_items.order_id
            AND (o.user_id = auth.uid() OR is_admin())
        )
      );
  END IF;
END $$;

DROP VIEW IF EXISTS public.customer_orders CASCADE;

CREATE VIEW public.customer_orders
WITH (security_invoker = on) AS
SELECT
  o.id,
  o.order_number,
  o.status,
  o.payment_status,
  o.total,
  o.created_at,
  o.user_id,
  COALESCE(
    json_agg(
      json_build_object(
        'title',    oi.title,
        'quantity', oi.quantity,
        'price',    oi.price,
        'image',    oi.image
      )
    ) FILTER (WHERE oi.id IS NOT NULL),
    '[]'
  ) AS items
FROM orders o
LEFT JOIN order_items oi ON oi.order_id = o.id
GROUP BY o.id;

REVOKE ALL ON public.customer_orders FROM anon;
GRANT SELECT ON public.customer_orders TO authenticated;


-- ────────────────────────────────────────────────────────────────
-- 6. products_public — a propósito pública (catálogo de la tienda),
--    solo se le agrega security_invoker por prolijidad/lint.
-- ────────────────────────────────────────────────────────────────
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


-- ================================================================
-- VERIFICACIÓN
-- ================================================================
-- 1) reloptions debe mostrar {security_invoker=true} en las 6:
-- SELECT relname, reloptions FROM pg_class
-- WHERE relname IN ('orders_overview','admin_clients_view',
--   'revenue_by_month','low_stock_products','customer_orders','products_public');
--
-- 2) Confirmar que ninguna vista admin quedó con acceso anon:
-- SELECT table_name, grantee, privilege_type
-- FROM information_schema.role_table_grants
-- WHERE table_schema='public'
--   AND table_name IN ('orders_overview','admin_clients_view',
--     'revenue_by_month','low_stock_products','customer_orders')
--   AND grantee = 'anon';
-- → debe devolver 0 filas
--
-- 3) Volver a correr Database → Advisors → Security en Supabase:
--    los 8 warnings de la lista original deberían desaparecer.
-- ================================================================


-- ================================================================
-- >>> fix-warnings-round2.sql
--     Warnings del Security Advisor, ronda 2
-- ================================================================

-- ================================================================
--  ARG INDUMENTARIA — Fix ronda 2: warnings del Security Advisor
--  Ejecutar en: Supabase Dashboard → SQL Editor → New Query
--
--  Cubre:
--    0011 function_search_path_mutable   (10 funciones)
--    0024 rls_policy_always_true          (orders / order_items)
--    0025 public_bucket_allows_listing    (bucket "products")
--    0028 / 0029 SECURITY DEFINER callable por anon/authenticated
--    (0032 auth_leaked_password_protection → NO es SQL, ver nota al final)
-- ================================================================


-- ================================================================
-- 1. function_search_path_mutable
--    Sin search_path fijo, una función SECURITY DEFINER puede ser
--    engañada creando objetos con el mismo nombre en otro schema
--    que quede antes en el search_path del que llama. Fijarlo a
--    "public" cierra ese vector, sin cambiar la lógica de ninguna.
-- ================================================================
ALTER FUNCTION public.set_updated_at()                       SET search_path = public;
ALTER FUNCTION public.is_admin()                              SET search_path = public;
ALTER FUNCTION public.is_superadmin()                         SET search_path = public;
ALTER FUNCTION public.update_user_profile_timestamp()         SET search_path = public;
ALTER FUNCTION public.create_user_profile_on_signup()         SET search_path = public;
ALTER FUNCTION public.sync_user_profile_email()               SET search_path = public;
ALTER FUNCTION public.check_order_rate_limit(text)            SET search_path = public;
ALTER FUNCTION public.get_product_stock(uuid)                 SET search_path = public;
ALTER FUNCTION public.decrement_stock(uuid, integer)          SET search_path = public;
-- Ojo: la firma lleva el uuid del final, que agrega
-- fix-place-order-user-id.sql. Sin ese parámetro no matchea ninguna
-- función y el script corta acá.
ALTER FUNCTION public.place_order(
  text, numeric, numeric, text, text, text, text, text, text, jsonb, uuid
) SET search_path = public;


-- ================================================================
-- 2. rls_policy_always_true — orders / order_items
--
--  Encontré 6 policies con USING/WITH CHECK (true). Repasando el
--  código del sitio:
--   - El checkout (src/app/checkout/page.tsx) ya NO inserta directo
--     en orders/order_items: usa el RPC place_order() (SECURITY
--     DEFINER, corre como dueño de la función → no necesita policy
--     de INSERT en la tabla). Las policies de INSERT quedaron
--     vestigiales de una versión anterior y solo agregan una puerta
--     extra por la que cualquiera podría insertar pedidos falsos
--     saltándose el rate-limit / validaciones de place_order().
--     → Se eliminan.
--   - El panel admin (admin/pedidos) SÍ borra pedidos directo con
--     supabase.from("orders").delete(...). Las policies de DELETE
--     actuales dejan borrar a CUALQUIER usuario autenticado (no solo
--     admins). Se corrigen para exigir is_admin().
-- ================================================================

-- Insert vestigiales → fuera
DROP POLICY IF EXISTS "Cualquiera puede crear pedido"    ON public.orders;
DROP POLICY IF EXISTS "orders_insert_authenticated"      ON public.orders;
DROP POLICY IF EXISTS "Cualquiera puede insertar items"  ON public.order_items;
DROP POLICY IF EXISTS "order_items_insert"               ON public.order_items;

-- Ya no hace falta que el cliente pueda insertar directo (place_order
-- corre con permisos propios y no depende de este GRANT)
REVOKE INSERT ON public.orders      FROM anon, authenticated;
REVOKE INSERT ON public.order_items FROM anon, authenticated;

-- Delete: antes "true" para cualquier autenticado → ahora solo admin
DROP POLICY IF EXISTS "orders_delete_authenticated" ON public.orders;
CREATE POLICY "orders_delete_authenticated" ON public.orders
  FOR DELETE USING (is_admin());

DROP POLICY IF EXISTS "order_items_delete" ON public.order_items;
CREATE POLICY "order_items_delete" ON public.order_items
  FOR DELETE USING (is_admin());
-- (esta es la que permite que el CASCADE de order_items funcione
--  cuando un admin borra un pedido desde el panel)


-- ================================================================
-- 3. public_bucket_allows_listing — bucket "products"
--    Un bucket público no necesita policy de SELECT en storage.objects
--    para que las imágenes se vean (getPublicUrl no pasa por RLS).
--    Esa policy solo servía para LISTAR/enumerar todos los archivos
--    del bucket vía API, cosa que el sitio no usa (confirmé que solo
--    se usa getPublicUrl, ningún .list()).
-- ================================================================
DROP POLICY IF EXISTS "Imágenes públicas" ON storage.objects;


-- ================================================================
-- 4. SECURITY DEFINER ejecutable por anon/authenticated (0028/0029)
--
--  De las 8 funciones marcadas, 6 SON necesarias que el cliente las
--  llame directo (así funciona el checkout), no se tocan:
--    check_order_rate_limit, decrement_stock, get_product_stock,
--    place_order, is_admin, is_superadmin
--  (is_admin/is_superadmin además se usan DENTRO de políticas RLS:
--   si les revocara EXECUTE a "authenticated", se rompería el acceso
--   normal de cualquier cliente logueado a productos/categorías/etc,
--   así que quedan como están — es un trade-off aceptado, no un bug.)
--
--  Las otras 2 son funciones de trigger puro (create_user_profile_on_
--  signup, sync_user_profile_email): nunca deberían llamarse por RPC,
--  solo las dispara auth.users automáticamente. Los triggers no
--  necesitan permiso de EXECUTE para dispararse, así que se lo
--  revocamos a todo el mundo sin romper nada.
-- ================================================================
REVOKE EXECUTE ON FUNCTION public.create_user_profile_on_signup() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_user_profile_email()       FROM PUBLIC;


-- ================================================================
-- VERIFICACIÓN
-- ================================================================
-- 1) search_path fijado en las 10 funciones:
-- SELECT proname, proconfig FROM pg_proc
-- WHERE pronamespace = 'public'::regnamespace
--   AND proname IN ('set_updated_at','is_admin','is_superadmin',
--     'update_user_profile_timestamp','create_user_profile_on_signup',
--     'sync_user_profile_email','check_order_rate_limit',
--     'get_product_stock','decrement_stock','place_order');
-- → proconfig debe mostrar {search_path=public} en las 10
--
-- 2) Confirmar que ya no hay policies "true" en orders/order_items:
-- SELECT tablename, policyname, cmd, qual, with_check
-- FROM pg_policies WHERE tablename IN ('orders','order_items');
--
-- 3) Volver a correr Database → Advisors → Security.
--    Deberían quedar SOLO estos 2, que no son SQL:
--    - is_admin() / is_superadmin() ejecutables por anon/authenticated
--      (aceptado, ver punto 4 arriba)
--    - auth_leaked_password_protection
-- ================================================================


-- ================================================================
-- NOTA — auth_leaked_password_protection (no se arregla con SQL)
-- Es un toggle de Supabase Auth, no una tabla/función/policy.
-- Se activa en: Dashboard → Authentication → Sign In / Providers
-- → Password → "Leaked password protection" (o "Prevent use of
-- compromised passwords" según la versión del dashboard). Actívalo
-- ahí manualmente, chequea contra HaveIBeenPwned al hacer login/signup.
-- ================================================================


-- ================================================================
-- >>> fix-warnings-round3.sql
--     Warnings del Security Advisor, ronda 3
-- ================================================================

-- ================================================================
--  ARG INDUMENTARIA — Fix ronda 3
--  El revoke anterior solo le sacó el EXECUTE a "PUBLIC", pero
--  anon/authenticated tienen grants propios (no heredados de PUBLIC)
--  sobre las funciones expuestas por PostgREST. Hay que revocarlo
--  explícito para esos dos roles.
-- ================================================================

REVOKE EXECUTE ON FUNCTION public.create_user_profile_on_signup()
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.sync_user_profile_email()
  FROM PUBLIC, anon, authenticated;

-- ================================================================
-- VERIFICACIÓN
-- ================================================================
-- SELECT p.proname, r.rolname, has_function_privilege(r.oid, p.oid, 'EXECUTE') AS puede_ejecutar
-- FROM pg_proc p
-- CROSS JOIN (VALUES ('anon'), ('authenticated')) AS r(rolname)
-- JOIN pg_roles ON pg_roles.rolname = r.rolname
-- WHERE p.pronamespace = 'public'::regnamespace
--   AND p.proname IN ('create_user_profile_on_signup','sync_user_profile_email');
-- → puede_ejecutar debe ser "false" en las 4 filas
-- ================================================================


-- ================================================================
-- >>> add-brand-oem.sql
--     Columnas brand y oem en productos
-- ================================================================

-- ============================================================
-- ARG INDUMENTARIA — marca del repuesto y número de parte OEM
-- Opcional pero recomendado: la ficha de producto los muestra
-- si existen y los ignora si no.
-- Correr en Supabase → SQL Editor.
-- ============================================================

alter table public.products
  add column if not exists brand text,
  add column if not exists oem   text;

comment on column public.products.brand is 'Marca del repuesto: Bosch, Brembo, Sachs…';
comment on column public.products.oem   is 'Número de parte original del fabricante del vehículo';

-- Búsqueda por número de parte
create index if not exists products_oem_idx
  on public.products (lower(oem));

create index if not exists products_brand_idx
  on public.products (lower(brand));


-- ================================================================
-- >>> seed-argarage.sql
--     Catalogo inicial: 11 rubros de autopartes y 23 repuestos
-- ================================================================

-- ============================================================
-- ARG INDUMENTARIA — carga inicial del catálogo
--
-- Carga los 11 rubros de autopartes con sus subrubros y 23
-- repuestos de arranque.
--
-- Correr DESPUÉS de supabase_schema.sql y de add-brand-oem.sql.
-- Es idempotente: si lo corrés dos veces actualiza, no duplica.
-- ============================================================

begin;

-- ── 1. Rubros de autopartes ──────────────────────────────────
insert into categories (id, name, sort_order) values
  ('motor',         'MOTOR',                    1),
  ('admision',      'ADMISIÓN Y COMBUSTIBLE',   2),
  ('escape',        'ESCAPE Y EMISIONES',       3),
  ('encendido',     'ENCENDIDO',                4),
  ('distribucion',  'DISTRIBUCIÓN',             5),
  ('refrigeracion', 'REFRIGERACIÓN',            6),
  ('climatizacion', 'CLIMATIZACIÓN',            7),
  ('frenos',        'FRENOS',                   8),
  ('suspension',    'SUSPENSIÓN',               9),
  ('direccion',     'DIRECCIÓN',               10),
  ('transmision',   'TRANSMISIÓN',             11),
  ('electrico',     'ELÉCTRICO',               12),
  ('electronica',   'ELECTRÓNICA Y SENSORES',  13),
  ('filtros',       'FILTROS Y LUBRICANTES',   14),
  ('optica',        'ÓPTICA Y CARROCERÍA',     15)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;

-- ── 2. Subrubros ─────────────────────────────────────────────
insert into subcategories (category_id, name, sort_order) values
  ('motor','Juntas y retenes',1),
  ('motor','Tapa de cilindros y válvulas',2),
  ('motor','Pistones, aros y bielas',3),
  ('motor','Bomba de aceite y cárter',4),
  ('motor','Soportes de motor',5),
  ('admision','Turbo e intercooler',1),
  ('admision','Inyectores y rieles',2),
  ('admision','Bomba de nafta y de alta presión',3),
  ('admision','Cuerpo de mariposa y colector',4),
  ('admision','Tanque y cañerías de combustible',5),
  ('escape','Catalizador y filtro de partículas',1),
  ('escape','Sonda lambda',2),
  ('escape','Válvula EGR y enfriador',3),
  ('escape','Silenciadores y caños',4),
  ('escape','Válvula PCV y ventilación de cárter',5),
  ('escape','Juntas, abrazaderas y soportes',6),
  ('encendido','Bujías',1),
  ('encendido','Bobinas y cables',2),
  ('encendido','Bujías de precalentado',3),
  ('encendido','Distribuidor y módulo de encendido',4),
  ('distribucion','Kits de distribución',1),
  ('distribucion','Correas y cadenas',2),
  ('distribucion','Tensores y poleas',3),
  ('distribucion','Correa de accesorios',4),
  ('refrigeracion','Radiadores',1),
  ('refrigeracion','Bomba de agua',2),
  ('refrigeracion','Termostatos',3),
  ('refrigeracion','Electroventiladores',4),
  ('refrigeracion','Mangueras y tapas',5),
  ('climatizacion','Compresor de aire acondicionado',1),
  ('climatizacion','Condensador y evaporador',2),
  ('climatizacion','Filtro deshidratador y válvula de expansión',3),
  ('climatizacion','Radiador de calefacción',4),
  ('climatizacion','Motor y resistencia de ventilación',5),
  ('climatizacion','Cañerías y gas refrigerante',6),
  ('frenos','Pastillas y cintas',1),
  ('frenos','Discos y campanas',2),
  ('frenos','Pinzas y bombines',3),
  ('frenos','Cilindro maestro y servo',4),
  ('frenos','Flexibles y cables de mano',5),
  ('frenos','Líquido de frenos',6),
  ('suspension','Amortiguadores',1),
  ('suspension','Espirales y elásticos',2),
  ('suspension','Parrillas y bujes',3),
  ('suspension','Rótulas y extremos',4),
  ('suspension','Rulemanes de rueda',5),
  ('suspension','Tuercas, centros y sensores de presión',6),
  ('direccion','Cremallera y caja',1),
  ('direccion','Bomba hidráulica',2),
  ('direccion','Barras y bieletas',3),
  ('direccion','Columna y crucetas',4),
  ('transmision','Kits de embrague',1),
  ('transmision','Volante bimasa',2),
  ('transmision','Semiejes y homocinéticas',3),
  ('transmision','Cardán y diferencial',4),
  ('transmision','Caja de transferencia 4x4',5),
  ('transmision','Convertidor de par',6),
  ('transmision','Filtro y aceite de caja automática',7),
  ('transmision','Soportes de caja',8),
  ('electrico','Baterías',1),
  ('electrico','Alternadores',2),
  ('electrico','Burros de arranque',3),
  ('electrico','Fusibles y relés',4),
  ('electrico','Motores de levantavidrios',5),
  ('electrico','Cableado y bornes',6),
  ('electronica','Módulos y computadoras',1),
  ('electronica','Sensores de motor',2),
  ('electronica','Caudalímetro y sensores de presión',3),
  ('electronica','Sensores de ABS y estabilidad',4),
  ('electronica','Sensores de estacionamiento y cámaras',5),
  ('electronica','Cerraduras, alarmas y llaves',6),
  ('filtros','Filtro de aceite',1),
  ('filtros','Filtro de aire',2),
  ('filtros','Filtro de combustible',3),
  ('filtros','Filtro de habitáculo',4),
  ('filtros','Aceites y aditivos',5),
  ('filtros','Refrigerante y fluidos',6),
  ('filtros','Tornillería, grasas y selladores',7),
  ('optica','Faros y ópticas',1),
  ('optica','Lámparas y leds',2),
  ('optica','Espejos',3),
  ('optica','Paragolpes y parrillas',4),
  ('optica','Escobillas y brazos',5),
  ('optica','Motor y bomba de limpiaparabrisas',6);

-- ── 3. Destacados ────────────────────────────────────────────
insert into especiales (id, name, sort_order) values
  ('novedades',  'NOVEDADES',             1),
  ('exclusivos', 'ORIGINALES DE FÁBRICA', 2),
  ('outlet',     'OFERTAS',               3)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;

-- ── 5. Productos de arranque ─────────────────────────────────
-- Precios de referencia en pesos: ajustalos desde el panel admin.
insert into products
  (title, price, icon, category_id, subcategory, brand, oem, description, stock, is_new, is_exclusive, is_outlet)
values
  ('Disco de freno delantero ventilado 300 mm', 214900, '🛞', 'frenos', 'Discos y campanas', 'Brembo', '2H0 615 301 A', 'Par de discos ventilados. VW Amarok 2.0 y 3.0 V6, 2011–2023.', 18, true, false, false),
  ('Pastillas de freno delanteras cerámicas', 96400, '🛞', 'frenos', 'Pastillas y cintas', 'Ferodo', '2H0 698 151', 'Juego de 4. Bajo nivel de polvillo y frenada estable en caliente.', 34, false, false, false),
  ('Líquido de frenos DOT 4 · 500 ml', 18700, '🧴', 'frenos', 'Líquido de frenos', 'Bosch', '1 987 479 107', 'Punto de ebullición seco 230 °C. Cambio recomendado cada 2 años.', 62, false, false, false),
  ('Amortiguador trasero a gas Reflex', 126700, '🔩', 'suspension', 'Amortiguadores', 'Monroe', '2H0 513 029', 'Unidad. VW Amarok 4x2 y 4x4, 2010–2022.', 4, false, false, true),
  ('Rulemán de rueda delantero con ABS', 88900, '🔩', 'suspension', 'Rulemanes de rueda', 'SKF', 'VKBA 6996', 'Kit completo con tuerca y sensor integrado.', 11, false, false, false),
  ('Rótula de suspensión inferior', 42300, '🔩', 'suspension', 'Rótulas y extremos', 'Febi', '3C0 407 365 A', 'Unidad, con tuerca y grasera. Recambio de par recomendado.', 27, false, false, false),
  ('Junta de tapa de cilindros multicapa', 134500, '⚙️', 'motor', 'Juntas y retenes', 'Mahle', '03L 103 383 AK', 'Metálica multicapa, espesor 1,41 mm. Motores 2.0 TDI CDCA / CNFA.', 7, false, true, false),
  ('Bomba de aceite con piñón de mando', 268000, '⚙️', 'motor', 'Bomba de aceite', 'Pierburg', '03L 115 105 B', 'Incluye junta y tornillería. Reemplazo obligatorio tras fundido de bancada.', 3, false, false, false),
  ('Bujía de platino de larga duración', 14200, '⚡', 'encendido', 'Bujías', 'NGK', '101 905 631 H', 'Unidad. Cambio cada 60.000 km en motores nafteros de inyección.', 148, false, false, false),
  ('Bobina de encendido individual', 57800, '⚡', 'encendido', 'Bobinas y cables', 'Bosch', '036 905 715 G', 'Unidad. Diagnóstico previo recomendado por código de falla.', 22, true, false, false),
  ('Bujía de precalentado 11 V', 21900, '⚡', 'encendido', 'Bujías de precalentado', 'Beru', '03L 963 319', 'Unidad. Cambio del juego completo en motores diésel.', 45, false, false, false),
  ('Batería S5 12 V · 95 Ah · 800 A', 289500, '🔋', 'electrico', 'Baterías', 'Bosch', '000 915 105 DK', 'Para diésel con start-stop. Borne positivo a la derecha.', 9, false, false, false),
  ('Alternador 140 A con polea de rueda libre', 612000, '🔋', 'electrico', 'Alternadores', 'Valeo', '03L 903 023 F', 'Remanufacturado con garantía de 12 meses. Entrega de la unidad usada.', 2, false, false, false),
  ('Kit de filtros — aceite, aire, habitáculo y combustible', 98300, '🧰', 'filtros', 'Filtro de aceite', 'Mann-Filter', 'KIT-VW-AMK-20TDI', 'Service completo. VW Amarok 2.0 TDI, 2011–2020.', 41, true, false, false),
  ('Aceite sintético 5W-30 C3 · 4 L', 76500, '🛢️', 'filtros', 'Aceites y aditivos', 'Motul', 'VW 504.00 / 507.00', 'Apto para motores con filtro de partículas. Bidón de 4 litros.', 58, false, false, false),
  ('Kit de distribución con bomba de agua', 476800, '⛓️', 'distribucion', 'Kits de distribución', 'Gates', '03L 198 119 D', 'Correa, tensor, poleas y bomba. Cambio cada 120.000 km.', 2, false, true, false),
  ('Correa de accesorios multi-V 6PK1875', 32400, '⛓️', 'distribucion', 'Correa de accesorios', 'Gates', '03L 903 137 T', 'Cambio junto con tensor y polea loca.', 33, false, false, false),
  ('Kit de embrague con volante bimasa', 1284000, '🌀', 'transmision', 'Kits de embrague', 'Sachs', '03L 141 015 M', 'Volante, disco, plato y rulemán. Caja manual de 6 velocidades.', 0, false, false, false),
  ('Radiador de agua con marco plástico', 342000, '❄️', 'refrigeracion', 'Radiadores', 'Behr', '2H0 121 253 B', 'Núcleo de aluminio. Incluye juntas de montaje.', 5, false, false, false),
  ('Termostato con carcasa y sensor', 64700, '❄️', 'refrigeracion', 'Termostatos', 'Wahler', '03L 121 111 AL', 'Apertura a 87 °C. Incluye junta tórica.', 16, false, false, true),
  ('Óptica delantera derecha con halógeno', 398000, '💡', 'optica', 'Faros y ópticas', 'Depo', '2H1 941 006 A', 'Equivalente homologado. Regulación eléctrica de altura.', 6, false, false, false),
  ('Juego de escobillas flat blade 24" + 20"', 27800, '💡', 'optica', 'Escobillas', 'Bosch', '3 397 007 430', 'Aerotwin con adaptador de gancho. Par.', 74, false, false, false),
  ('Extremo de dirección exterior', 38900, '🎯', 'direccion', 'Barras y bieletas', 'Corteco', '2H0 422 803', 'Unidad. Alineación obligatoria después del cambio.', 29, false, false, false)
;

commit;

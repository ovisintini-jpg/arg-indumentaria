-- ============================================================
--  ARG INDUMENTARIA — ¿Qué scripts me faltan correr?
-- ============================================================
--  Pegá TODO esto en Supabase → SQL Editor → New query → Run.
--  No cambia nada: sólo mira y te devuelve una lista.
--
--  Para cada script te dice si ya lo corriste o si falta. Los que digan
--  FALTA se corren igual: abrís el archivo de supabase/parches/, copiás
--  todo, lo pegás en una query nueva y Run.
--
--  Están en orden. Si te falta más de uno, corrélos de arriba para abajo:
--  algunos necesitan que el anterior ya esté.
-- ============================================================

select * from (

  select 1 as orden,
         'parches/columnas-faltantes.sql' as script,
         case when exists (select 1 from information_schema.columns
                            where table_schema='public' and table_name='products'
                              and column_name='cost_price')
              then '✅ ya corrido'
              else '⚠️  FALTA — al editar un producto en el panel va a dar error'
         end as estado

  union all
  select 2,
         'parches/consultas.sql',
         case when to_regclass('public.consultas') is not null
              then '✅ ya corrido'
              else '⚠️  FALTA — los pedidos por encargo del formulario no se guardan'
         end

  union all
  select 3,
         'parches/arrepentimientos.sql',
         case when to_regclass('public.arrepentimientos') is not null
              then '✅ ya corrido'
              else '⚠️  FALTA — el formulario de arrepentimiento no guarda'
         end

  union all
  select 4,
         'parches/pagos.sql',
         case when to_regclass('public.webhook_events') is not null
              then '✅ ya corrido'
              else '⚠️  FALTA — con Mercado Pago activo, ningún pedido se marca como pagado'
         end

  union all
  select 5,
         'parches/verificar-pago-admin.sql',
         case when exists (select 1 from pg_proc where proname='admin_actualizar_pago')
              then '✅ ya corrido'
              else '⚠️  FALTA — el botón "Verificar pago" del panel no funciona'
         end

  union all
  select 6,
         'parches/pedidos-especiales.sql',
         case when exists (select 1 from information_schema.columns
                            where table_schema='public' and table_name='products'
                              and column_name='visibilidad')
              then '✅ ya corrido'
              else '⚠️  FALTA — no vas a poder vender por encargo con link privado'
         end

  union all
  select 7,
         'parches/pedidos-especiales.sql · la parte de seguridad',
         case when not exists (select 1 from information_schema.columns
                                where table_schema='public' and table_name='products'
                                  and column_name='visibilidad')
              then '— (primero corré el script del punto 6)'
              when exists (select 1 from pg_policies
                            where tablename='products' and cmd='SELECT'
                              and qual like '%catalogo%')
              then '✅ los pedidos especiales están escondidos'
              else '🚨 PELIGRO — los pedidos especiales se ven desde la tienda. Volvé a correr pedidos-especiales.sql'
         end

  union all
  select 8,
         'parches/slugs-y-seo.sql',
         case when exists (select 1 from information_schema.columns
                            where table_schema='public' and table_name='products'
                              and column_name='slug')
              then '✅ ya corrido'
              else '⚠️  FALTA — cada producto necesita su dirección propia para Google'
         end

  union all
  select 9,
         'parches/indumentaria.sql · talles y colores',
         case when exists (select 1 from information_schema.columns
                            where table_schema='public' and table_name='products'
                              and column_name='stock_variantes')
              then '✅ ya corrido'
              else '⚠️  FALTA — sin esto no hay talles ni colores, y la tienda es de ropa'
         end

  union all
  select 10,
         'parches/indumentaria.sql · el catálogo del rubro',
         case when exists (select 1 from categories where id='mujer')
              then '✅ ya corrido'
              else '⚠️  FALTA — la home sigue mostrando las categorías de autopartes'
         end

  union all
  select 11,
         'parches/indumentaria.sql · el talle en el pedido',
         case when exists (select 1 from information_schema.columns
                            where table_schema='public' and table_name='order_items'
                              and column_name='talle')
              then '✅ ya corrido'
              else '⚠️  FALTA — un pedido de ropa llegaría sin saber qué talle es'
         end

  union all
  select 12,
         'parches/indumentaria.sql · la marca del pie de página',
         case when exists (select 1 from site_settings
                            where id=1 and site_name='ARG INDUMENTARIA')
              then '✅ ya corrido (o el nombre ya está bien)'
              else '⚠️  FALTA — el pie del sitio muestra el nombre de la tienda vieja'
         end

  -- Los dos controles que no son de un script sino del resultado: el
  -- checkout y el formulario llaman a estas funciones por nombre. Si de
  -- alguna quedan dos versiones conviviendo, la llamada falla.
  union all
  select 13,
         'una sola place_order() — la del checkout',
         case (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                where n.nspname='public' and p.proname='place_order')
              when 1 then '✅ una sola'
              when 0 then '🚨 no existe — el checkout no puede cerrar ningún pedido'
              else '🚨 HAY DOS — el checkout va a fallar. Volvé a correr pedidos-especiales.sql y después indumentaria.sql'
         end

  union all
  select 14,
         'una sola crear_consulta() — la del pedido por encargo',
         case when to_regclass('public.consultas') is null
              then '— (primero corré el script del punto 2)'
              else case (select count(*) from pg_proc p
                           join pg_namespace n on n.oid = p.pronamespace
                          where n.nspname='public' and p.proname='crear_consulta')
                     when 1 then '✅ una sola'
                     when 0 then '🚨 no existe — el formulario de encargo no guarda'
                     else '🚨 HAY DOS — quedó viva la de autopartes. Volvé a correr indumentaria.sql'
                   end
         end

) t order by orden;


-- ── De yapa: cómo está el catálogo hoy ───────────────────────
--  Tienen que ser las 11 categorías de indumentaria. Si ves MOTOR,
--  FRENOS o SUSPENSIÓN, te falta indumentaria.sql.
select c.sort_order as "#", c.name as categoria, count(s.id) as subcategorias
  from categories c
  left join subcategories s on s.category_id = c.id
 group by c.sort_order, c.name
 order by c.sort_order;

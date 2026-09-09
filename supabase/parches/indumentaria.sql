-- ============================================================
--  ARG INDUMENTARIA — Adaptación al rubro: talles, colores y categorías
-- ============================================================
--  QUÉ HACE
--  Convierte la base de la tienda al rubro de indumentaria y calzado:
--
--    1. products.oem  →  products.sku          (el código interno)
--    2. Columnas nuevas en products: precio anterior, género, talles,
--       colores, stock por variante, material, composición y cuidados.
--    3. order_items guarda TALLE y COLOR de cada renglón, y place_order()
--       los escribe. Sin esto, un pedido de ropa llega sin talle.
--    4. Borra los productos de demostración de autopartes y reemplaza sus
--       categorías por las 11 de indumentaria, con sus subcategorías.
--    5. Barre los productos que hayan quedado sin categoría.
--    6. Adapta la tabla `consultas` (los pedidos por encargo): en vez de
--       preguntar por un vehículo, pregunta por prenda, marca, talle y color.
--    7. Pone la marca —nombre, mail y redes del pie— en la fila de
--       configuración del sitio, que es la que gana sobre el código.
--
--  CUÁNDO CORRERLO
--  Después de setup-supabase.sql y de los parches de slugs, pagos y
--  pedidos-especiales. Es el último de la lista.
--
--  ES SEGURO CORRERLO DOS VECES: no duplica nada y no pisa datos cargados.
--
--  Supabase Dashboard → SQL Editor → New query → pegar → Run.
-- ============================================================

begin;

-- ────────────────────────────────────────────────────────────
-- 1. El código del producto: oem → sku
--    En autopartes el código era el número de parte del fabricante
--    (OEM). Acá es el código interno del depósito, y llamarlo OEM
--    confunde a cualquiera que abra la base.
-- ────────────────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='products' and column_name='oem')
     and not exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='products' and column_name='sku')
  then
    alter table public.products rename column oem to sku;
  end if;
end $$;

alter table public.products
  add column if not exists sku text;

comment on column public.products.sku is
  'Código interno del producto. Es con el que se lo busca en el depósito.';

drop index if exists products_oem_idx;
create index if not exists products_sku_idx on public.products (lower(sku));


-- ────────────────────────────────────────────────────────────
-- 2. Las columnas propias del rubro
--
--    stock_variantes es un jsonb con la forma {"M|Negro": 4}. La clave
--    la arma variantKey() en src/types/index.ts y es la MISMA en toda la
--    aplicación: catálogo, carrito, checkout y panel.
--
--    Por qué jsonb y no una tabla de variantes: una tabla es lo correcto
--    para un depósito grande, pero obliga a un join en cada listado y a
--    un ABM aparte en el panel. Para una tienda de un local, el jsonb
--    entra entero con el producto, se edita en una grilla y no agrega
--    ninguna consulta. Si algún día hay miles de SKU, se migra: la
--    aplicación lee el stock por una sola función (stockDeVariante).
-- ────────────────────────────────────────────────────────────
alter table public.products
  add column if not exists price_before    numeric(12,2),
  add column if not exists genero          text,
  add column if not exists sizes           text[],
  add column if not exists colors          jsonb,
  add column if not exists stock_variantes jsonb,
  add column if not exists material        text,
  add column if not exists composicion     text,
  add column if not exists cuidados        text;

comment on column public.products.price_before is
  'Precio anterior. Si es mayor que price, la tienda lo muestra tachado y calcula el % de descuento.';
comment on column public.products.sizes is
  'Talles publicados, en el orden en que se muestran: {"S","M","L"}.';
comment on column public.products.colors is
  'Colores: [{"name":"Negro","hex":"#161616"}]. El hex es la muestra redonda, no el color exacto de la tela.';
comment on column public.products.stock_variantes is
  'Stock por talle y color: {"M|Negro": 4}. Si está vacío, vale el stock general.';

-- El género es texto libre con control: si mañana hace falta otro valor,
-- se agrega acá y no hay que tocar un tipo enum.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'products_genero_check') then
    alter table public.products
      add constraint products_genero_check
      check (genero is null or genero in ('mujer','hombre','unisex','nina','nino','bebe'));
  end if;
end $$;

create index if not exists products_genero_idx on public.products (genero);


-- ────────────────────────────────────────────────────────────
-- 3. El talle y el color viajan en el pedido
--    Es EL dato del rubro. Un pedido sin talle no se puede preparar.
-- ────────────────────────────────────────────────────────────
alter table public.order_items
  add column if not exists talle text,
  add column if not exists color text;

-- place_order() se vuelve a crear para que escriba las dos columnas nuevas.
-- El resto de la función es idéntica a la del parche de pedidos especiales.
create or replace function public.place_order(
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
  p_user_id              uuid    default null,
  p_shipping_cost        numeric default 0
)
returns table(order_id uuid, order_number text)
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  v_id    uuid;
  v_num   text;
  v_item  jsonb;
  v_envio numeric := COALESCE(p_shipping_cost, 0);
BEGIN
  IF v_envio < 0 THEN
    RAISE EXCEPTION 'El costo de envio no puede ser negativo.';
  END IF;

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
    INSERT INTO public.order_items
      (order_id, product_id, title, price, icon, image, quantity, talle, color)
    VALUES (
      v_id,
      (v_item->>'product_id')::uuid,
      v_item->>'title',
      (v_item->>'price')::numeric,
      v_item->>'icon',
      v_item->>'image',
      (v_item->>'quantity')::integer,
      v_item->>'talle',
      v_item->>'color'
    );
  END LOOP;

  RETURN QUERY SELECT v_id, v_num;
END;
$function$;


-- ────────────────────────────────────────────────────────────
-- 4. Las categorías del rubro
--    Primero se van los productos de demostración de autopartes y
--    recién después las categorías que los agrupaban.
--
--    El orden importa y no es un detalle de estilo: products.category_id
--    está declarado ON DELETE SET NULL. Si se borraran antes las
--    categorías, los 23 repuestos de ejemplo quedarían con la categoría
--    en NULL y ya no habría forma de reconocerlos: seguirían saliendo en
--    la home, entre los destacados. Borrándolos por su categoría vieja se
--    van los que vinieron de la carga inicial y ninguno más.
--
--    Los pedidos que tengan alguno de estos productos no se pierden:
--    order_items guarda el nombre y el precio del momento de la compra, y
--    su product_id también es ON DELETE SET NULL.
-- ────────────────────────────────────────────────────────────
delete from public.products where category_id in (
  'motor','admision','escape','encendido','distribucion','refrigeracion',
  'climatizacion','frenos','suspension','direccion','transmision',
  'electrico','electronica','filtros','optica'
);

delete from public.categories where id in (
  'motor','admision','escape','encendido','distribucion','refrigeracion',
  'climatizacion','frenos','suspension','direccion','transmision',
  'electrico','electronica','filtros','optica'
);

insert into public.categories (id, name, sort_order) values
  ('mujer',            'MUJER',                    1),
  ('hombre',           'HOMBRE',                   2),
  ('ninas',            'NIÑAS',                    3),
  ('ninos',            'NIÑOS',                    4),
  ('bebes',            'BEBÉS',                    5),
  ('calzado-mujer',    'CALZADO MUJER',            6),
  ('calzado-hombre',   'CALZADO HOMBRE',           7),
  ('calzado-infantil', 'CALZADO INFANTIL',         8),
  ('deportivo',        'DEPORTIVO',                9),
  ('interior',         'ROPA INTERIOR Y PIJAMAS', 10),
  ('accesorios',       'ACCESORIOS',              11)
on conflict (id) do update
  set name = excluded.name, sort_order = excluded.sort_order;

-- Antes de cargarlas: la tabla de subcategorías sólo tiene único el `id`,
-- que se genera solo. Con eso, el "on conflict do nothing" de la carga de
-- abajo nunca se activaba y correr este script dos veces dejaba cada
-- subcategoría duplicada. Se limpian las repetidas que hayan quedado y se
-- crea la regla que las hace imposibles de acá en adelante.
delete from public.subcategories s
 where exists (
   select 1 from public.subcategories o
    where o.category_id = s.category_id
      and lower(o.name)  = lower(s.name)
      and o.ctid         < s.ctid
 );

create unique index if not exists subcategories_categoria_nombre_key
  on public.subcategories (category_id, lower(name));

insert into public.subcategories (category_id, name, sort_order) values
  ('mujer','Remeras y tops',1),
  ('mujer','Camisas y blusas',2),
  ('mujer','Vestidos',3),
  ('mujer','Pantalones y jeans',4),
  ('mujer','Faldas y shorts',5),
  ('mujer','Buzos y sweaters',6),
  ('mujer','Camperas y abrigos',7),
  ('mujer','Blazers y sastrería',8),
  ('mujer','Trajes de baño',9),

  ('hombre','Remeras y chombas',1),
  ('hombre','Camisas',2),
  ('hombre','Pantalones y jeans',3),
  ('hombre','Bermudas y shorts',4),
  ('hombre','Buzos y sweaters',5),
  ('hombre','Camperas y abrigos',6),
  ('hombre','Trajes y sacos',7),
  ('hombre','Mallas',8),

  ('ninas','Remeras y tops',1),
  ('ninas','Vestidos y polleras',2),
  ('ninas','Pantalones y calzas',3),
  ('ninas','Buzos y camperas',4),
  ('ninas','Conjuntos',5),
  ('ninas','Escolar',6),

  ('ninos','Remeras',1),
  ('ninos','Pantalones y joggings',2),
  ('ninos','Bermudas',3),
  ('ninos','Buzos y camperas',4),
  ('ninos','Conjuntos',5),
  ('ninos','Escolar',6),

  ('bebes','Bodies y enteritos',1),
  ('bebes','Conjuntos',2),
  ('bebes','Pilotines y abrigos',3),
  ('bebes','Ajuar y primera puesta',4),
  ('bebes','Gorros y medias',5),

  ('calzado-mujer','Zapatillas urbanas',1),
  ('calzado-mujer','Botas y botinetas',2),
  ('calzado-mujer','Sandalias',3),
  ('calzado-mujer','Chatitas y mocasines',4),
  ('calzado-mujer','Zapatos de vestir',5),
  ('calzado-mujer','Ojotas',6),

  ('calzado-hombre','Zapatillas urbanas',1),
  ('calzado-hombre','Zapatillas deportivas',2),
  ('calzado-hombre','Botas y borcegos',3),
  ('calzado-hombre','Zapatos de vestir',4),
  ('calzado-hombre','Mocasines',5),
  ('calzado-hombre','Ojotas y sandalias',6),

  ('calzado-infantil','Zapatillas',1),
  ('calzado-infantil','Botitas de bebé',2),
  ('calzado-infantil','Sandalias',3),
  ('calzado-infantil','Escolar',4),
  ('calzado-infantil','Pantuflas',5),

  ('deportivo','Running',1),
  ('deportivo','Training y gimnasio',2),
  ('deportivo','Fútbol',3),
  ('deportivo','Outdoor y trekking',4),
  ('deportivo','Conjuntos deportivos',5),
  ('deportivo','Camisetas de club',6),

  ('interior','Lencería',1),
  ('interior','Ropa interior masculina',2),
  ('interior','Pijamas y camisones',3),
  ('interior','Medias',4),
  ('interior','Ropa térmica',5),

  ('accesorios','Carteras y bolsos',1),
  ('accesorios','Mochilas',2),
  ('accesorios','Cinturones',3),
  ('accesorios','Gorras y sombreros',4),
  ('accesorios','Bufandas y guantes',5),
  ('accesorios','Lentes de sol',6),
  ('accesorios','Relojes y joyas',7)
on conflict do nothing;

-- Los tres destacados, con los nombres del rubro.
insert into public.especiales (id, name, sort_order) values
  ('novedades',  'NOVEDADES',    1),
  ('exclusivos', 'SELECCIÓN ARG', 2),
  ('outlet',     'OUTLET',       3)
on conflict (id) do update set name = excluded.name;


-- ────────────────────────────────────────────────────────────
-- 5. Red de seguridad: productos que quedaron sin categoría
--    Los de la carga inicial ya se fueron en el punto 4. Esto barre los
--    que hayan quedado colgados de una corrida anterior de este mismo
--    script, cuando todavía borraba las categorías primero: sin categoría
--    y sin talles cargados, no puede ser una prenda hecha desde el panel
--    (el alta de Admin → Productos exige categoría).
-- ────────────────────────────────────────────────────────────
delete from public.products
where category_id is null
  and sizes is null;


-- ────────────────────────────────────────────────────────────
-- 6. Las consultas: de "qué pieza para qué auto" a "qué prenda,
--    en qué talle y en qué color"
-- ────────────────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_name='consultas' and column_name='pieza_descripcion') then
    alter table public.consultas rename column pieza_descripcion to producto_buscado;
  end if;
  if exists (select 1 from information_schema.columns
             where table_name='consultas' and column_name='vehiculo_marca') then
    alter table public.consultas rename column vehiculo_marca to marca_buscada;
  end if;
  if exists (select 1 from information_schema.columns
             where table_name='consultas' and column_name='vehiculo_anio') then
    alter table public.consultas rename column vehiculo_anio to talle_buscado;
  end if;
  if exists (select 1 from information_schema.columns
             where table_name='consultas' and column_name='vehiculo_motor') then
    alter table public.consultas rename column vehiculo_motor to color_buscado;
  end if;
  if exists (select 1 from information_schema.columns
             where table_name='consultas' and column_name='vin') then
    alter table public.consultas rename column vin to referencia;
  end if;
  if exists (select 1 from information_schema.columns
             where table_name='consultas' and column_name='pieza_oem') then
    alter table public.consultas rename column pieza_oem to codigo;
  end if;
end $$;

-- La columna del modelo del vehículo ya no tiene sentido y era NOT NULL:
-- si sigue existiendo, se afloja para que no bloquee las consultas nuevas.
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_name='consultas' and column_name='vehiculo_modelo') then
    alter table public.consultas alter column vehiculo_modelo drop not null;
  end if;
end $$;

alter table public.consultas
  add column if not exists producto_buscado text,
  add column if not exists marca_buscada    text,
  add column if not exists talle_buscado    text,
  add column if not exists color_buscado    text,
  add column if not exists referencia       text,
  add column if not exists codigo           text;

-- Lo único obligatorio es QUÉ busca. Marca, talle y color pasan a opcionales:
-- el que pide por encargo muchas veces sabe sólo la mitad de los datos, y un
-- formulario que le exige lo que no sabe se abandona.
alter table public.consultas alter column producto_buscado set not null;
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_name='consultas' and column_name='marca_buscada') then
    alter table public.consultas alter column marca_buscada drop not null;
  end if;
  if exists (select 1 from information_schema.columns
             where table_name='consultas' and column_name='talle_buscado') then
    alter table public.consultas alter column talle_buscado drop not null;
  end if;
end $$;

-- La función que usa el formulario de la tienda. Se borra la vieja (cambian
-- los nombres de los parámetros, así que no alcanza con "or replace").
-- La de la tienda de autopartes: trece parámetros, con los del vehículo.
-- Si queda viva convive con la nueva y escribe en columnas que ya no
-- existen, así que se va.
drop function if exists public.crear_consulta(
  text, text, text, text, text, text, text, text, text, text[], text, text, uuid);
drop function if exists public.crear_consulta(
  text, text, text, text, text, text, text, text, text[], text, text, uuid);
drop function if exists public.crear_consulta(
  text, text, text, text, text, text, text, text[], text, text, uuid);

create or replace function public.crear_consulta(
  p_producto_buscado   text,
  p_nombre             text,
  p_email              text,
  p_marca_buscada      text    default null,
  p_talle_buscado      text    default null,
  p_color_buscado      text    default null,
  p_referencia         text    default null,
  p_codigo             text    default null,
  p_fotos              text[]  default null,
  p_whatsapp           text    default null,
  p_contacto_preferido text    default 'email',
  p_user_id            uuid    default null
)
returns table(consulta_id uuid, consulta_numero text)
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  v_id  uuid;
  v_num text;
BEGIN
  IF p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'email_invalido';
  END IF;

  -- Freno anti-abuso: cinco consultas por email por día alcanzan de sobra
  -- para un cliente de verdad y frenan el formulario disparado por un bot.
  IF (SELECT count(*) FROM public.consultas
      WHERE email = lower(trim(p_email))
        AND created_at > now() - interval '1 day') >= 5 THEN
    RAISE EXCEPTION 'demasiadas_consultas';
  END IF;

  INSERT INTO public.consultas (
    producto_buscado, marca_buscada, talle_buscado, color_buscado,
    referencia, codigo, fotos,
    nombre, email, whatsapp, contacto_preferido, user_id
  ) VALUES (
    trim(p_producto_buscado), p_marca_buscada, p_talle_buscado, p_color_buscado,
    p_referencia, p_codigo, p_fotos,
    trim(p_nombre), lower(trim(p_email)), p_whatsapp,
    coalesce(p_contacto_preferido, 'email'), p_user_id
  )
  RETURNING id, numero INTO v_id, v_num;

  RETURN QUERY SELECT v_id, v_num;
END;
$function$;

grant execute on function public.crear_consulta(
  text, text, text, text, text, text, text, text, text[], text, text, uuid
) to anon, authenticated;

-- ────────────────────────────────────────────────────────────
-- 7. La marca, que vive en la base
--    site_settings es la fila que gana: el nombre, el mail y las redes
--    que se ven en el pie del sitio salen de acá, no del código. Mientras
--    siga con los datos de la tienda de autopartes, el pie va a decir
--    "ARG GARAGE AUTOPARTS" por más que todo lo demás ya sea de ropa.
--
--    Sólo pisa lo que todavía es el valor viejo. Si ya cambiaste algo
--    desde Admin → Configuración, lo respeta.
-- ────────────────────────────────────────────────────────────
update public.site_settings set site_name = 'ARG INDUMENTARIA'
 where id = 1 and site_name in
   ('ARG GARAGE AUTOPARTS','ARGARAGE AUTOPARTS','Argarage Autoparts');

update public.site_settings set banner_text = 'INDUMENTARIA . CALZADO . ACCESORIOS'
 where id = 1 and banner_text in ('REPUESTOS . MOTOR . RUTA', '');

update public.site_settings set email = 'ventas@argindumentaria.com.ar'
 where id = 1 and email in ('ventas@arggarage.com.ar','ventas@argarage.com.ar');

update public.site_settings set instagram = '@arg.indumentaria'
 where id = 1 and instagram in ('@arggarage.autoparts','@argarage.autoparts');

update public.site_settings set facebook = 'argindumentaria'
 where id = 1 and facebook in ('arggarageautoparts','argarageautoparts');

-- El envío gratis que anuncia la home es $120.000. Este número no lo lee
-- la tienda —hoy es sólo el que muestra el panel—, pero que diga otra cosa
-- que el sitio es la clase de detalle que después nadie entiende.
update public.site_settings set free_shipping_min = 120000
 where id = 1 and free_shipping_min = 50000;


commit;


-- ────────────────────────────────────────────────────────────
-- 8. CONTROL
--    Tiene que dar todo ✅. Si algo dice FALTA, el script no terminó.
-- ────────────────────────────────────────────────────────────
select
  case when exists (select 1 from information_schema.columns
                    where table_name='products' and column_name='sku')
       then '✅' else '⚠️ FALTA' end as estado,
  'products.sku' as que
union all select
  case when exists (select 1 from information_schema.columns
                    where table_name='products' and column_name='stock_variantes')
       then '✅' else '⚠️ FALTA' end,
  'products.stock_variantes'
union all select
  case when exists (select 1 from information_schema.columns
                    where table_name='order_items' and column_name='talle')
       then '✅' else '⚠️ FALTA' end,
  'order_items.talle'
union all select
  case when (select count(*) from public.categories) = 11
       then '✅' else '⚠️ REVISAR' end,
  'las 11 categorías de indumentaria'
union all select
  case when exists (select 1 from information_schema.columns
                    where table_name='consultas' and column_name='producto_buscado')
       then '✅' else '⚠️ FALTA' end,
  'consultas.producto_buscado'
union all select
  case when not exists (select 1 from public.products where category_id is null)
       then '✅' else '⚠️ REVISAR' end,
  'ningún producto quedó sin categoría'
union all select
  case when exists (select 1 from public.site_settings
                    where id = 1 and site_name = 'ARG INDUMENTARIA')
       then '✅' else '⚠️ REVISAR' end,
  'la marca del pie de página';

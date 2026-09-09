# Base de datos

**Ninguno de estos scripts se corre solo.** Los tenés que correr vos en Supabase:
**SQL Editor → New query → pegar todo → Run.** Claude no puede: la base sólo la abre
tu proyecto de Supabase con tu sesión.

```
supabase/
├── chequeo.sql          🩺 empezá acá — te dice qué te falta. NO cambia nada
├── crear-admin.sql         da acceso al panel /admin a un usuario
├── parches/                ✅ para la base que ya tenés. Se corren en este orden
│   ├── 1. columnas-faltantes.sql
│   ├── 2. consultas.sql
│   ├── 3. arrepentimientos.sql
│   ├── 4. pagos.sql
│   ├── 5. verificar-pago-admin.sql
│   ├── 6. pedidos-especiales.sql
│   ├── 7. slugs-y-seo.sql        (necesita el 6)
│   └── 8. indumentaria.sql       (el que pasa la tienda a ropa)
└── base-desde-cero/     ⛔ SÓLO para un proyecto de Supabase nuevo y vacío
    └── setup-supabase.sql
```

**La regla es simple: si tu base ya existe, todo lo que vas a correr está en `parches/`.**
La carpeta `base-desde-cero/` está aparte justamente para que no se mezcle: ese script
arma todo de cero y sobre una base armada se corta con un error.

---

## 🩺 `chequeo.sql` — empezá por acá

No cambia nada. Te devuelve una lista que dice, script por script, si ya lo corriste o
si falta, y de yapa te muestra cómo está el catálogo hoy. **Si no te acordás qué
corriste, corré esto primero.**

Los dos últimos controles no miran un script sino el resultado: que haya **una sola**
`place_order()` y **una sola** `crear_consulta()`. El checkout y el formulario de encargo
las llaman por nombre, así que si de alguna quedan dos versiones conviviendo, la llamada
falla y no es nada evidente por qué.

---

## `base-desde-cero/setup-supabase.sql`

El esquema completo: 11 tablas, 6 vistas, 30 políticas de seguridad (RLS), las funciones
del checkout y el bucket de imágenes. **Se corre una sola vez**, sobre un proyecto de
Supabase recién creado.

Ojo con una cosa: el catálogo de arranque que trae adentro **todavía es el de
autopartes** (15 rubros y 23 repuestos de ejemplo). Es el esquema lo que sirve de ahí;
el rubro lo pone `parches/indumentaria.sql`, que es el que hay que correr después.

Si lo corrés de nuevo sobre una base que ya existe, se corta en la primera línea con
*relation "categories" already exists* y no toca nada.

## `crear-admin.sql`

Te da acceso al panel `/admin`. Antes hay que crear el usuario en
**Authentication → Users → Add user**, tildando *Auto Confirm User*.

Después este script lo busca por email y lo inserta en `admin_users`. Son las dos cosas
que el login necesita: existir en Auth **y** estar en esa tabla.

---

## Parches para una base que ya existe

Todos se pueden correr más de una vez sin romper nada.

### `parches/columnas-faltantes.sql`

Agrega a `products` las columnas `cost_price` (precio de costo interno), `brand` y el
código del producto, y recrea la vista pública `products_public` para que incluya la
marca — sin exponer el costo.

### `parches/consultas.sql`

Crea la tabla `consultas`, donde caen los pedidos por encargo que la gente manda desde
el formulario. Sin esto el formulario no guarda nada.

### `parches/arrepentimientos.sql`

Crea la tabla `arrepentimientos`, del botón de arrepentimiento de compra que exige la
Ley 24.240. Sin esto ese formulario no guarda nada.

### `parches/pagos.sql`

Crea `webhook_events` y las funciones que dejan que Mercado Pago marque un pedido como
pagado. Sin esto, con Mercado Pago activo ningún pedido cambia de estado solo.

### `parches/verificar-pago-admin.sql`

La función `admin_actualizar_pago()`, que es la que usa el botón **Verificar pago** del
panel para consultar el estado real de un pago y actualizarlo.

### `parches/pedidos-especiales.sql`

**Lo que hace posible vender algo que no está en el catálogo.** Crea el producto privado:
existe en la base y se puede pagar, pero no sale en la tienda — se llega sólo por un link
secreto que le mandás al cliente que lo pidió.

De paso arregla dos cosas viejas:

- **`orders.shipping_cost` deja de ser decorativa.** Existía desde el primer día y
  `place_order()` metía un `0` escrito a mano. Ahora el envío se cobra y se muestra
  separado del precio.
- **Aprieta la verificación de precios del checkout.** Hay una función
  (`verificar_precios`) que ve todos los productos, y el pedido se corta si algo no
  cierra.

**El cambio importante y delicado** es de seguridad: la política de lectura de `products`
pasa de `USING (true)` —cualquiera con la clave anon veía toda la tabla— a
`USING (visibilidad = 'catalogo')`. Sin eso, los pedidos especiales se leerían enteros
desde la consola del navegador.

### `parches/slugs-y-seo.sql`

Le da a cada producto su propia dirección (`/producto/remera-oversize-algodon`) y arma
el sitemap. **Va después de `pedidos-especiales.sql`**, porque necesita saber cuáles
productos son privados para no darles dirección pública. Si lo corrés antes, se frena
solo con un cartel y no toca nada.

### `parches/indumentaria.sql` — 09/09/2026

**El que pasa la tienda de autopartes a indumentaria.** Es el último de la lista y el
más grande. Hace siete cosas, todas dentro de una transacción:

1. `products.oem` → `products.sku`.
2. Columnas nuevas en `products`: precio anterior, género, talles, colores, stock por
   variante, material, composición y cuidados.
3. `order_items` guarda **talle y color**, y `place_order()` los escribe. Sin esto un
   pedido de ropa llega sin saber de qué talle es.
4. Borra los 23 repuestos de demostración y reemplaza las 15 categorías de autopartes
   por las **11 de indumentaria** con sus 69 subcategorías.
5. Barre los productos que hubieran quedado sin categoría.
6. Adapta `consultas`: en vez de vehículo, marca, año y VIN, pregunta por prenda, marca,
   talle y color. La `crear_consulta()` vieja se borra.
7. Pone la marca —nombre, banner, mail y redes del pie— en `site_settings`, que es la
   fila que gana sobre lo que dice el código. Sólo pisa lo que sigue siendo el valor
   viejo: si ya cambiaste algo desde **Admin → Configuración**, lo respeta.

**Los pedidos viejos no se pierden.** `order_items` guarda el nombre y el precio del
momento de la compra, y su `product_id` es `ON DELETE SET NULL`: el pedido queda entero
aunque el producto ya no exista.

Termina con un cuadro de control que tiene que dar **siete ✅**.

---

## Verificado

Los scripts no se entregan sin probarlos. Como Supabase no es alcanzable desde donde
trabaja Claude, se levanta un PostgreSQL 16 real y se corren ahí, imitando `auth.users`,
`auth.uid()` y `storage` cuando hace falta.

- **Corrida limpia entera** (09/09/2026): esquema + los ocho parches en orden, sin un
  solo error. Resultado: 11 categorías, 69 subcategorías, 0 productos, ninguna función
  duplicada.
- **Corrida sobre una base "en uso"**: la de autopartes con sus 23 repuestos y un pedido
  ya cerrado encima. Después de `indumentaria.sql` el pedido sigue entero —con el nombre
  y el precio del repuesto que se compró— y no quedó ni un producto viejo en el catálogo.
- **Alta y compra de una prenda**: producto con talles, colores y stock por variante,
  pedido cerrado con `place_order()` y el renglón guardando **talle M, color Negro**.
  Pedido por encargo cargado con `crear_consulta()` y leído desde `consultas`.
- **Corrido cuatro veces seguidas**: sin duplicar categorías ni subcategorías y sin
  romper nada.

Tres cosas que esa prueba encontró y que están arregladas en el script que tenés:

- **Los repuestos de ejemplo no se borraban.** El script borraba primero las categorías;
  como `products.category_id` es `ON DELETE SET NULL`, los 23 repuestos quedaban con la
  categoría en NULL y ya no había forma de reconocerlos: seguían saliendo en la home.
  Ahora se borran **antes** que las categorías.
- **Las subcategorías se duplicaban** al correrlo dos veces: la tabla no tenía nada único
  más que el `id`, así que el `on conflict do nothing` nunca se activaba. Ahora limpia
  las repetidas y crea la regla que lo impide.
- **Quedaba viva la `crear_consulta()` de autopartes**, con trece parámetros. Convivían
  dos funciones con el mismo nombre y la vieja escribía en columnas que ya no existen.

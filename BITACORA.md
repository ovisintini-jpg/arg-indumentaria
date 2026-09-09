# Bitácora — ARG Indumentaria

> Dónde quedó el proyecto, qué se hizo, por qué, y qué falta.
> Última actualización: **9 de septiembre de 2026**.

---

## 0. Qué es esto

Una tienda de **indumentaria y calzado** construida sobre el código del proyecto
anterior (ARG Garage Autoparts). Se conservó **toda la maquinaria**: Next.js 16
con App Router, React 19, TypeScript, Tailwind 4, Supabase (base, auth, storage),
Mercado Pago y Stripe, Resend para los mails, y el panel de administración
completo. Lo que cambió es **el rubro y el diseño**.

Stack, sin cambios respecto del proyecto anterior:

| Pieza | Qué hace |
|---|---|
| Next.js 16 (App Router) | Las páginas, el renderizado en servidor y el SEO |
| Supabase | Base de datos, cuentas de usuario y fotos |
| Mercado Pago / Stripe | Cobro |
| Resend | Mails de confirmación y avisos internos |
| Tailwind 4 | Estilos, sobre el sistema de diseño de `globals.css` |

Arranque: `npm install` y `npm run dev` → http://localhost:3000
El panel está en `/admin`. La puesta a punto completa de la base sigue en
**COMO-EMPEZAR.md**.

---

## 1. Las decisiones que ordenan todo lo demás

Se tomaron el 9/9 con Omar, antes de escribir una línea:

1. **Se transforma el proyecto en el mismo lugar**, no se copia a una carpeta
   nueva. La carpeta `ARG INDUMENTARIA` ES el proyecto.
2. **Hay talle y color**, con stock por variante. Es el cambio funcional más
   grande respecto de autopartes y toca tipos, carrito, checkout, base y panel.
3. **Identidad blanco y negro editorial**, con un acento cálido. Elegante sin
   irse al lujo: práctica y moderna.
4. La marca es **ARG Indumentaria**, ropa y calzado para toda la familia.

---

## 2. De dónde salió el diseño

Se relevaron las páginas que pidió Omar (Macy's, JCPenney, Saks, Nordstrom Rack,
DSW, Nike, Rack Room, Adidas, Hollister). Lo que se tomó de cada una:

- **Nordstrom Rack** — la barra de anuncio arriba de todo, el buscador ancho y
  prominente, los bloques de color plano con título grande y botón (el recurso
  que permite que la home se vea terminada **sin una sola foto**), y la fila de
  departamentos como atajo.
- **DSW / Nordstrom** — el *quick add*: los talles aparecen sobre la foto al
  pasar el mouse y se agrega al carrito de un click, sin entrar a la ficha. Y la
  columna de filtros fija a la izquierda.
- **Nike / Hollister** — fotografía grande, tipografía enorme y mucho blanco.
  La interfaz no compite con el producto.
- **Saks** — el aire entre secciones y el uso del gris sólo para jerarquía.
- **Macy's / JCPenney** — el precio con el anterior tachado y el porcentaje en
  rojo, que es la convención que el cliente lee sin pensar.

Lo que **no** se copió: los banners saturados y las tres promociones apiladas.
Se eligió una campaña por bloque.

---

## 3. El sistema de diseño

Todo vive en `src/app/globals.css`. Cambió de un mundo oscuro (grafito + azul)
a uno claro (papel + tinta + terracota).

**Colores** (los nombres de las variables se conservaron para no tocar 90
archivos; lo que cambió son los valores):

| Variable | Valor | Para qué |
|---|---|---|
| `ink` | `#FFFFFF` | fondo de la página |
| `panel` | `#FAF9F7` | superficie de módulo |
| `raise` | `#F1EFEB` | hover y caja de foto |
| `line` / `linehi` | `#E4E1DB` / `#BEB9AF` | filetes |
| `chalk` | `#14120F` | texto y botón primario — 17,6:1 |
| `mute` | `#57534C` | bajadas — 7,7:1 |
| `dim` | `#78726A` | metadatos — 4,9:1 |
| `acento` | `#9A4520` | terracota: link activo, dato de cuenta |
| `sale` | `#C1272D` | el rojo de OFERTA |

Ningún gris baja de 4,5:1 sobre blanco. La jerarquía la hacen el tamaño y el
peso, no el gris.

**Tipografía**: Archivo para titulares, **Inter** para lectura e interfaz (antes
era Barlow, que sobre papel claro tiraba a "taller"), Barlow Condensed para
rótulos y botones en mayúscula, IBM Plex Mono para SKU y números de pedido.

**Piezas nuevas** en `globals.css`: `.ag-talle` (el cuadrado del selector de
talle, con el talle agotado **tachado** en vez de escondido), `.ag-color` (la
muestra redonda con anillo de selección), `.ag-chip` (las chapitas de oferta y
novedad), `.ag-precio-antes` (el tachado), `.ag-carrusel` (las filas que se
arrastran de costado en el celular en vez de apilarse).

El prefijo de clases sigue siendo `ag-*`.

---

## 4. Qué se hizo, archivo por archivo

### 4.1 Dominio

- **`src/types/index.ts`** — reescrito. `Product` suma `sizes`, `colors`,
  `stock_variantes`, `price_before`, `genero`, `material`, `composicion`,
  `cuidados`. `oem` pasó a `sku`. `CartItem` suma `size`, `color` y `lineId`.
  Aparecen dos funciones que usa **toda** la aplicación: `variantKey()` (la
  clave `"M|Negro"` del stock por variante) y `lineIdDe()` (la identidad de un
  renglón del carrito). `Consulta` cambió de preguntar por un vehículo a
  preguntar por prenda, marca, talle y color.
- **`src/data/categories.ts`** — las 11 categorías del rubro (Mujer, Hombre,
  Niñas, Niños, Bebés, Calzado Mujer, Calzado Hombre, Calzado Infantil,
  Deportivo, Ropa interior y pijamas, Accesorios) con sus subcategorías. Suma
  `ESCALAS_DE_TALLE` (letras, numérica, jean, calzado, niños, bebés) y `COLORES`
  (la paleta con la que se cargan las prendas, para que "Negro" se escriba
  siempre igual y el filtro funcione).
- **`src/data/products.ts`** — 31 productos de demostración con talles, colores,
  precios anteriores y, en dos de ellos, el detalle de stock por variante. El
  slug se calcula solo desde el título, así la ficha se puede abrir sin base.
- **`src/components/Icons.tsx`** — reescrito. Once íconos de prenda y calzado
  dibujados a mano, más los de interfaz (bolsa en vez de changuito, corazón,
  camión, cambio, escudo, regla, filtro). `productIcon()` elige el ícono
  mirando la subcategoría y el título, no sólo la categoría: si no, todas las
  prendas de "Mujer" salían con el mismo vestido.

### 4.2 Carrito con variantes

- **`src/context/CartContext.tsx`** — reescrito. El renglón ya no se identifica
  por producto sino por **producto + talle + color**: dos remeras iguales en
  talles distintos son dos renglones. `addItem(product, {size, color, qty})`;
  `removeItem/increment/decrement` reciben `lineId`. El tope de cada renglón es
  el stock de esa variante (`stockDeVariante()`), o el stock general si el
  producto no tiene el detalle cargado. Exporta también `necesitaVariante()`.
- **`CartPanel.tsx`** — rediseñado: barra de progreso de envío gratis, talle y
  color a la vista en cada renglón, aviso de últimas unidades.
- **`checkout/page.tsx`** — el talle y el color viajan en el renglón del pedido
  y además quedan escritos en el título, para que aparezcan sí o sí en el mail
  de confirmación.

### 4.3 Vidriera

| Archivo | Qué pasó |
|---|---|
| `Hero.tsx` | Reescrito: bloque de campaña + dos departamentos + fila de atajos. Funciona **sin fotos** y mejora con ellas (`FOTO_CAMPANA`, `FOTO_MUJER`, `FOTO_HOMBRE` arriba del archivo). |
| `Beneficios.tsx` | **Nuevo.** Envío, cambios, talles y pago: las cuatro dudas que frenan una compra de ropa. |
| `CategoryTiles.tsx` | Ahora cada baldosa es un **link real** a `/categoria/<id>`, no un filtro invisible. |
| `ProductCard.tsx` | Reescrito. Sin caja, foto vertical 3:4, quick add de talles al hover, precio con tachado y %, muestras de color. Incluye `BotonFavorito`. |
| `ProductThumb.tsx` | **Nuevo.** La caja de foto, en un solo lugar (la usaban cuatro archivos con cuatro fondos distintos). |
| `ProductGrid.tsx` | 2 columnas en celular, 4 en escritorio. |
| `ProductCatalog.tsx` | Reescrito con **filtros**: talle, color, marca, precio y sólo ofertas. Columna fija en escritorio, cajón en celular. Migas de pan. |
| `GuiaTalles.tsx` | **Nuevo.** Cuatro tablas de medidas (mujer, hombre, calzado, niños). Es lo que evita la mitad de las devoluciones. |
| `BandaImagen.tsx` | Reescrito: las bandas ahora llevan título y botón, y **sin foto se dibujan como bloque de color**, no como hueco. |
| `Header.tsx` | Reescrito: barra de anuncio rotativa, barra utilitaria, departamentos con **menú desplegable** que muestra las subcategorías reales del catálogo. Las once categorías se agrupan en **siete departamentos** (Chicos junta niñas/niños/bebés, Calzado junta los tres): con las once, a 1440 px la fila se desbordaba y empujaba el buscador y la bolsa fuera de la pantalla. El buscador de escritorio se abre con la lupa, en su propia fila a todo el ancho. |
| `Sidebar.tsx` | Ahora **navega** (`/categoria/...`) en vez de sólo filtrar; el nombre entra a la sección y la flecha despliega. |
| `Footer.tsx` | Reescrito. Todos los links van a páginas que existen (antes tres apuntaban a un bloque del hero que no explicaba nada). Suma medios de pago y de envío. |
| `Brands.tsx`, `SectionHead.tsx` | Adaptados al rubro y al tema claro. |
| `not-found.tsx`, `error.tsx` | Reescritos en tema claro. La 404 ofrece cuatro atajos en vez de un cartel. |
| `QuoteModal.tsx` + `QuoteContext.tsx` | El "cotizador de repuestos" pasó a ser **pedido por encargo**: qué prenda, marca, talle, color, link de referencia y fotos. Entra por ahí el que no encuentra su talle. |

### 4.4 Rutas

Se renombraron para que la dirección diga la verdad:

```
/repuesto/<slug>  →  /producto/<slug>
/rubro/<id>       →  /categoria/<id>
/pieza/<token>    →  /pedido-especial/<token>
```

`/categoria/[id]` se reescribió y ahora atiende tres casos con el mismo archivo:
una categoría, una lista especial (`novedades`, `exclusivos`, `outlet`) y
`todos`; además acepta `?sub=Vestidos`.

`/producto/[slug]` suma talles, colores y material al JSON-LD, y **cae al
catálogo de arranque** cuando no hay base configurada (antes toda ficha daba 404
en una instalación recién clonada).

### 4.5 Base de datos

Archivo nuevo: **`supabase/parches/indumentaria.sql`**. Es el último de la lista
y hace seis cosas:

1. `products.oem` → `products.sku`.
2. Agrega `price_before`, `genero`, `sizes`, `colors`, `stock_variantes`,
   `material`, `composicion`, `cuidados`.
3. Agrega `talle` y `color` a `order_items` y **rehace `place_order()`** para
   que los escriba.
4. Borra los productos de demostración de autopartes y reemplaza sus 15
   categorías por las 11 del rubro con todas sus subcategorías.
5. Barre los productos que hayan quedado sin categoría.
6. Adapta `consultas` y rehace `crear_consulta()`.
7. Pone la marca —nombre, banner, mail y redes— en `site_settings`, que es la
   fila que gana sobre el código (reemplaza al viejo `marca.sql`).

Trae control al final: tiene que dar los siete ✅.

Se borraron `parches/rubros.sql` y `parches/marca.sql` (cargaban rubros de
autopartes) y se renombró `piezas-a-pedido.sql` → `pedidos-especiales.sql`.

**Por qué el stock por variante es `jsonb` y no una tabla**: una tabla es lo
correcto para un depósito grande, pero obliga a un join en cada listado y a un
ABM aparte en el panel. Para una tienda de un local, el jsonb entra entero con
el producto, se edita en una grilla y no agrega ninguna consulta. Si algún día
hay miles de SKU se migra: la aplicación lee el stock por **una sola función**
(`stockDeVariante`).

### 4.6 Panel de administración

`/admin/productos` suma un bloque completo de indumentaria: escalas de talle con
un click, talles publicados, paleta de colores, **grilla de stock por talle y
color**, precio anterior, material, composición y cuidados. El resto del panel
(pedidos, clientes, finanzas, reseñas, configuración) quedó igual y funciona,
sólo cambió el vocabulario.

`src/lib/columnas.ts` es nuevo: pide las columnas de variantes y, si la base
todavía no tiene el parche corrido, **reintenta sin ellas**. La tienda funciona
igual (sin selector de talle) y empieza a traerlas sola el día que se corre el
parche, sin tocar código.

---

## 5. Estado actual

- ✅ `npx tsc --noEmit` sin errores.
- ✅ `npx eslint src` sin errores (24 avisos, todos preexistentes del proyecto
  anterior sobre `setState` dentro de `useEffect`).
- ✅ `npm run build` compila y genera todas las rutas.
- ✅ Revisión visual hecha en escritorio (1440 px) y celular (390 px) sobre el
  catálogo de demostración. Salieron de ahí cuatro correcciones: el header que se
  desbordaba (ver 4.3), el panel del carrito que sumaba ancho aunque estuviera
  cerrado (ahora lleva `invisible`, y `html` también corta el desborde lateral),
  la 404 y la pantalla de error que seguían en tema oscuro, y el ícono de la
  tarjeta, que mostraba el mismo vestido para toda la sección Mujer y ahora se
  elige mirando la subcategoría y el título (`productIcon()`).

  La verificación se hizo compilando el proyecto y sacando capturas con un
  navegador real. **Ojo con una limitación del entorno**: ni la máquina virtual
  local ni el contenedor tienen salida a Google Fonts, así que `npm run build`
  falla ahí al descargar Archivo, Inter, Barlow Condensed y IBM Plex Mono. Para
  la revisión se reemplazaron por la tipografía del sistema. **En tu máquina, con
  internet, el build baja las fuentes y anda.**
- ✅ Los ocho scripts de `supabase/` corridos contra un PostgreSQL 16 real
  (09/09), en orden y sobre tres bases distintas: una vacía, una que imitaba la
  tienda de autopartes en uso —con un pedido ya cerrado— y una migrada, para
  probar que se pueden correr dos veces. Alta de una prenda con talles y
  colores, compra con `place_order()` guardando talle y color, y pedido por
  encargo con `crear_consulta()`. El detalle, en `supabase/LEEME.md`.
- ⚠️ La base **todavía no tiene corrido** `parches/indumentaria.sql`. Hasta que
  se corra, la tienda anda pero sin talles ni colores, y la home sigue mostrando
  las categorías y los repuestos de la tienda anterior. En la consola del
  navegador eso se ve como dos 400 de Supabase por carga: son los intentos de
  pedir las columnas nuevas, que reintentan solos con la lista básica
  (`src/lib/columnas.ts`).

---

## 6. Lo que falta

Ordenado por lo que más mueve la aguja:

1. **Correr `supabase/parches/indumentaria.sql`** en el SQL Editor de Supabase.
   Sin esto no hay talles, ni colores, ni talle en los pedidos.
2. **Fotos.** Es lo único que separa esta tienda de una tienda de verdad. Van en
   `public/images/` y se enganchan en tres lugares:
   - `src/components/Hero.tsx` → `FOTO_CAMPANA`, `FOTO_MUJER`, `FOTO_HOMBRE`
   - `src/components/BandaImagen.tsx` → `FOTOS`
   - cada producto, desde Admin → Productos
   Se borraron las tres fotos de autos del proyecto anterior. **Queda pendiente
   reemplazar `public/images/og-default.jpg`**, que sigue siendo la imagen de
   autopartes y es la que se ve al compartir el link por WhatsApp.
3. **Cargar el catálogo real** desde el panel, con talles y colores.
4. **Datos del negocio** en Admin → Configuración: mail, WhatsApp, Instagram.
   Hoy están los de relleno (`ventas@argindumentaria.com.ar`, `+54 9 351
   000-0000`) y el pie los muestra tal cual.
5. **Términos y condiciones** (`LegalModal.tsx`): ya están reescritos para el
   rubro; quedan los `[REMPLAZAR: …]` de razón social, CUIT y domicilio.
6. **Ajustar los números que están escritos a mano**: el envío gratis desde
   $120.000 aparece en `CartPanel.tsx`, `Beneficios.tsx`, `Header.tsx` y la
   ficha. Convendría que salgan de Admin → Configuración.
7. **Favoritos**: el corazón funciona pero guarda en el navegador, no en la
   base. Cuando exista la tabla `favoritos`, se cambia sólo `BotonFavorito` en
   `ProductCard.tsx`.
8. **Páginas de ayuda** (envíos, cambios, preguntas frecuentes). Hoy esos temas
   viven en el acordeón de la ficha y en la guía de talles, y el pie manda ahí.
9. Revisar las **reseñas** (`Resenas.tsx`): siguen las del rubro anterior.

---

## 7. Cosas que conviene saber antes de tocar el código

- **El talle es obligatorio para comprar.** La ficha no deja agregar a la bolsa
  sin elegirlo, y el botón dice qué falta en vez de estar apagado sin explicar.
  Si se afloja eso, los pedidos llegan sin talle y alguien tiene que llamar al
  cliente.
- **La clave del stock por variante es `"TALLE|COLOR"`** y la arma `variantKey()`
  en `src/types/index.ts`. Si se cambia el formato, hay que cambiarlo ahí y en
  ningún otro lado — pero hay que migrar los datos ya cargados.
- **Un talle agotado se muestra tachado, no se esconde.** El cliente necesita
  saber que existe pero que no está.
- **La home funciona sin fotos a propósito.** Los bloques de color plano son una
  decisión, no un placeholder: si se los reemplaza por huecos grises esperando
  imágenes, la tienda se ve rota desde el primer día.
- **Los grises tienen contraste medido.** Antes de bajar un `mute` o un `dim`,
  mirar la tabla de la sección 3.
- El prefijo `ag-*` de las clases se conservó a propósito: renombrarlo obligaba
  a tocar noventa archivos sin ganar nada.

---

## 8. Registro de cambios

**09/09/2026 (segunda pasada)** — Se probaron los scripts SQL contra un
PostgreSQL 16 real y aparecieron tres cosas que en Supabase habrían salido mal y
sin ruido: (a) los 23 repuestos de ejemplo **no se borraban**, porque el script
borraba primero las categorías y `products.category_id` es `ON DELETE SET NULL`,
así que quedaban sin categoría y seguían saliendo en la home — ahora se borran
antes; (b) las subcategorías **se duplicaban** al correrlo dos veces, porque la
tabla no tenía nada único más que el `id` y el `on conflict do nothing` nunca se
activaba; (c) quedaba viva la `crear_consulta()` de autopartes, de trece
parámetros, conviviendo con la nueva y escribiendo en columnas que ya no
existen. Además: `chequeo.sql` reescrito para los ocho parches de hoy, con dos
controles nuevos que verifican que no haya funciones duplicadas; limpieza de los
textos que seguían diciendo "repuesto", "rubro" y "vehículo" en el panel, en el
email de confirmación, en el alias del checkout y en las notas del pedido; el
aviso interno de pedido por encargo (`/api/consulta-nueva`) que **llegaba vacío**
porque seguía esperando `vehiculo`/`vin`/`pieza` mientras el formulario ya
mandaba `producto`/`detalle`; términos y condiciones reescritos para indumentaria
(cláusulas 5, 6, 7, 10, 12, 13 y 14: talles, cambios, higiene y garantía textil);
y `README`, `COMO-EMPEZAR` y `supabase/LEEME` puestos al día.

**09/09/2026** — Conversión completa de ARG Garage Autoparts a ARG Indumentaria:
rediseño del sistema de diseño a tema claro editorial, talles y colores con
stock por variante en toda la cadena (tipos → carrito → checkout → base →
panel), 11 categorías nuevas, rutas renombradas, filtros de catálogo, guía de
talles, home rearmada, pedido por encargo en reemplazo del cotizador de piezas,
y el parche SQL `indumentaria.sql`.

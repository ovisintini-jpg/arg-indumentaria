# ARG Indumentaria — puesta en marcha

> **Si ya tenés la base andando** (que es el caso desde agosto de 2026), lo único que
> necesitás de este documento es la sección **"Mantener la base al día"**, acá abajo.
> El resto es para armar todo de cero en una máquina o una cuenta nueva.

```bash
npm install
npm run dev
```

Tienda en <http://localhost:3000> · panel en <http://localhost:3000/admin>

---

## Lo primero, si venís de la tienda de autopartes

**Corré `supabase/parches/indumentaria.sql`.** El código ya es de ropa, pero las
categorías, los talles y los colores viven en Supabase: hasta que no lo corras, la home
sigue mostrando MOTOR, FRENOS y SUSPENSIÓN y los repuestos de ejemplo.

Ese script hace, de una sola vez y dentro de una transacción:

- cambia `products.oem` por `products.sku`;
- agrega talles, colores, stock por variante, precio anterior, género, material,
  composición y cuidados;
- guarda **talle y color en cada renglón del pedido** (sin esto un pedido de ropa llega
  sin saber qué talle es);
- borra los repuestos de demostración y reemplaza las 15 categorías de autopartes por
  las **11 de indumentaria** con sus 69 subcategorías;
- convierte el formulario de encargo: en vez de preguntar por un vehículo, pregunta por
  prenda, marca, talle y color;
- pone la marca —nombre, mail y redes del pie— en la fila de configuración del sitio.

Los pedidos que ya tengas **no se pierden**: `order_items` guarda el nombre y el precio
del momento de la compra.

---

## Mantener la base al día

Cada tanto un cambio del sitio necesita también un cambio en Supabase. Esos cambios van
en **`supabase/parches/`** y se corren a mano: **SQL Editor → New query → pegar todo → Run.**

**No hace falta que te acuerdes cuáles corriste.** Pegá `supabase/chequeo.sql` y te
devuelve la lista con un ✅ o un ⚠️ al lado de cada uno. No cambia nada, sólo mira.

Van en este orden. Si te falta más de uno, corrélos de arriba para abajo: algunos
necesitan que el anterior ya esté.

| # | Parche | Para qué |
|---|---|---|
| 1 | `parches/columnas-faltantes.sql` | Las columnas `cost_price`, `brand` y `sku` |
| 2 | `parches/consultas.sql` | La tabla donde caen los pedidos por encargo |
| 3 | `parches/arrepentimientos.sql` | La tabla del botón de arrepentimiento (Ley 24.240) |
| 4 | `parches/pagos.sql` | Los webhooks de Mercado Pago |
| 5 | `parches/verificar-pago-admin.sql` | El botón "Verificar pago" del panel |
| 6 | `parches/pedidos-especiales.sql` | Vender por link privado lo que no está en el catálogo |
| 7 | `parches/slugs-y-seo.sql` | La dirección propia de cada producto (necesita el 6) |
| 8 | `parches/indumentaria.sql` | Talles, colores y las 11 categorías del rubro |

Todos se pueden correr más de una vez sin romper nada.

> ⛔ **`supabase/base-desde-cero/setup-supabase.sql` no va sobre una base que ya existe.**
> Arma todo desde cero y sobre una base armada se corta con
> *relation "categories" already exists*. Ahora te frena solo con un cartel que te dice
> cuál correr en su lugar. Está guardado en su propia carpeta justamente para que no se
> mezcle con los parches.

---

## Armar todo de cero

Sólo para un proyecto de Supabase nuevo y vacío.

### 1. Crear el proyecto en Supabase

1. <https://supabase.com> → **New project**.
2. Nombre: `arg-indumentaria`. Región: *South America (São Paulo)*.
   Guardá bien la contraseña de la base que te pide.
3. Esperá a que termine de provisionar (1–2 minutos).

Conviene **tildar "Enable automatic RLS"**. En este proyecto no cambia nada —las tablas
del script ya activan Row Level Security y todas tienen sus políticas— pero deja un
trigger que protege cualquier tabla que crees a mano más adelante y te olvides de
asegurar. La contra: toda tabla nueva nace bloqueada hasta que le escribas una política.
Si alguna vez consultás una tabla nueva y te devuelve una lista vacía sin error, es eso.

### 2. Cargar el esquema y después el rubro

1. **SQL Editor → New query**.
2. Abrí `supabase/base-desde-cero/setup-supabase.sql`, copiá **todo**, pegalo y **Run**.
   Ese script todavía arma la base con el catálogo de autopartes: es el esquema completo
   —tablas, vistas, políticas y funciones— con un catálogo de ejemplo encima.
3. Corré **los ocho parches** de la tabla de arriba, en orden. El último,
   `indumentaria.sql`, es el que deja la base en indumentaria: cambia las categorías,
   agrega talles y colores y borra los productos de ejemplo.
4. Verificá con `supabase/chequeo.sql`: tiene que dar todo ✅ y listar las **11
   categorías** (MUJER, HOMBRE, NIÑAS, …).

### 3. Conectar la app con Supabase

1. **Project Settings → API**.
2. Copiá **Project URL** y la clave **anon / public**.
3. Pegalas en `.env.local`, en la raíz del proyecto:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
   ```

4. Reiniciá el servidor (`Ctrl+C` y de nuevo `npm run dev`).
   Next.js sólo lee `.env.local` al arrancar.

---

## Entrar al panel admin

**El panel vive en `/admin`** → <http://localhost:3000/admin>
(no hay ningún botón hacia él en la tienda: es a propósito, se entra por URL).

Para que te deje pasar hacen falta **dos cosas**, no una:

1. **Un usuario en Supabase Auth** (email + contraseña).
2. **Ese mismo usuario cargado en la tabla `admin_users`.**
   Si falta esto último, el login dice *"Tu cuenta no tiene acceso al panel admin"*
   aunque la contraseña sea correcta.

### Cómo hacerlo

1. Supabase → **Authentication → Users → Add user → Create new user**.
   Poné tu email y una contraseña, y **tildá "Auto Confirm User"** (si no, queda
   pendiente de confirmación por mail y no vas a poder entrar).
2. Supabase → **SQL Editor**: abrí `supabase/crear-admin.sql`, cambiá
   `TU-EMAIL@EJEMPLO.COM` por el email del paso 1 y corré el script.
   Busca solo el UUID del usuario, así no tenés que copiar nada a mano.
3. Entrá a <http://localhost:3000/admin> con ese email y contraseña.

Desde ahí manejás productos, categorías, pedidos, pedidos especiales, reseñas, clientes,
finanzas y la configuración del sitio (nombre, contacto, redes, envío gratis desde…).

---

## Lo que queda pendiente

- **Catálogo real.** Después de correr `indumentaria.sql` la tienda queda **sin
  productos**, a propósito: los 23 repuestos de ejemplo eran de VW Amarok. Se cargan
  desde **Admin → Productos**, con sus talles, colores y stock por variante.
- **Datos reales de contacto y bancarios.** Hoy son inventados: el alias
  `ARG.INDUMENTARIA` y el CBU en cero de la pantalla de checkout, el email
  `ventas@argindumentaria.com.ar`, el Instagram `@arg.indumentaria` y el teléfono.
  Los de contacto se cambian desde **Admin → Config** (quedan en la base); el alias y el
  CBU están escritos en `src/app/checkout/page.tsx`.
- **Términos y Condiciones.** Ya están reescritos para indumentaria —talles, cambios,
  higiene, garantía textil—, pero tienen tramos resaltados en amarillo
  `[REMPLAZAR: …]` con la razón social, el CUIT y el domicilio. Hay que completarlos
  antes de publicar.
- **Emails de pedido.** Necesitan una `RESEND_API_KEY` y un dominio verificado en Resend.
  Sin eso, el pedido se guarda igual pero no sale el mail.
- **Fotos de producto.** Sin imagen, la ficha cae al ícono de la categoría.
- **Reseñas viejas.** Las de la tienda de autopartes siguen en la base y se ven en la
  home. Se ocultan una por una desde **Admin → Reseñas**.
- **Dominio.** `robots.ts` y `sitemap.ts` apuntan a `argindumentaria.com.ar`;
  se sobrescribe con `NEXT_PUBLIC_SITE_URL`.

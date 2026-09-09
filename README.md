# ARG Indumentaria

E-shop de indumentaria y calzado. Next.js 16 (App Router) + React 19 + TypeScript +
Tailwind 4 + Supabase + Resend.

## Puesta en marcha

```bash
npm install
npm run dev
```

Abrir http://localhost:3000 · el panel de gestión está en http://localhost:3000/admin

La puesta a punto completa (crear la base, cargar el catálogo, darte acceso al panel)
está paso a paso en **[COMO-EMPEZAR.md](./COMO-EMPEZAR.md)**.

## Estructura

- `src/app` — rutas: home, `/producto/[slug]`, `/categoria/[id]`, `/pedido-especial/[token]`,
  checkout, mi-cuenta, reset-password, admin y la API de emails
- `src/components` — UI de la tienda (header, hero, catálogo, carrito, guía de talles, modales)
- `src/components/admin/ui.tsx` — piezas compartidas del panel de gestión
- `src/context` — estado global (carrito con talle y color, productos, categorías, usuario)
- `src/lib/supabase.ts` — cliente y mapeo base ↔ TypeScript
- `src/data` — categorías y catálogo de arranque (se usan si Supabase no está configurado)
- `src/app/globals.css` — sistema de diseño: colores, tipografías y clases `ag-*`
- `supabase/` — los scripts de la base. **Empezá por `supabase/chequeo.sql`**, que te
  dice cuáles te faltan correr ([leer](./supabase/LEEME.md))

## Panel admin

`/admin` — productos, categorías, pedidos, pedidos especiales, clientes, finanzas,
reseñas y configuración. Pide dos cosas: usuario en Supabase Auth **y** una fila con ese
id en `admin_users`.

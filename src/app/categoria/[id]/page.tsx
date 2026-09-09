// src/app/categoria/[id]/page.tsx
//
// La página de una categoría, con todos sus productos. Vale más de lo que
// parece para que te encuentren: la gente busca "campera de jean mujer" mucho
// antes que el nombre exacto de una prenda, y esta es la página que puede
// responder a esa búsqueda.
//
// Es además el camino que necesita Google para llegar a cada ficha:
// home → categoría → producto, todo con links de verdad en el HTML.
//
// Atiende tres tipos de dirección con el mismo archivo:
//   /categoria/mujer      → una categoría del catálogo
//   /categoria/outlet     → una lista especial (novedades, selección, outlet)
//   /categoria/todos      → el catálogo entero
// y acepta ?sub=Vestidos para entrar directo a una subcategoría.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { ProductCard } from "@/components/ProductCard";
import { supabaseServidor, supabaseServidorConfigurado, urlDelSitio } from "@/lib/supabase-server";
import { productFromDB } from "@/lib/supabase";
import { conColumnas } from "@/lib/columnas";
import { Product } from "@/types";
import { jsonLdMigas, ldJson, ogImagenAbsoluta } from "@/lib/seo";
import { categories as CATEGORIAS_DE_ARRANQUE, especiales as ESPECIALES_DE_ARRANQUE } from "@/data/categories";
import { products as PRODUCTOS_DE_ARRANQUE } from "@/data/products";

export const revalidate = 300;

/** Las listas que no son una categoría sino un estado del producto. */
const ESPECIALES: Record<string, { name: string; filtro: (p: Product) => boolean }> = {
  novedades:  { name: "Novedades",   filtro: (p) => Boolean(p.isNew) },
  exclusivos: { name: "Selección ARG", filtro: (p) => Boolean(p.isExclusive) },
  outlet:     { name: "Outlet",      filtro: (p) => Boolean(p.isOutlet) },
  todos:      { name: "Todo el catálogo", filtro: () => true },
};

interface Datos {
  seccion: { id: string; name: string };
  productos: Product[];
  subCategories: string[];
}

async function traerSeccion(id: string): Promise<Datos | null> {
  const especial = ESPECIALES[id];

  /* Sin credenciales (un `npm run dev` recién clonado) se usan los datos de
     arranque: la página se ve igual y no hay que montar la base para trabajar
     en el diseño. */
  if (!supabaseServidorConfigurado) {
    const cat = CATEGORIAS_DE_ARRANQUE.find((c) => c.id === id);
    if (especial) {
      return {
        seccion: { id, name: especial.name },
        productos: PRODUCTOS_DE_ARRANQUE.filter(especial.filtro),
        subCategories: [],
      };
    }
    if (!cat) return null;
    return {
      seccion: { id: cat.id, name: cat.name },
      productos: PRODUCTOS_DE_ARRANQUE.filter((p) => p.categoryId === id),
      subCategories: cat.subCategories,
    };
  }

  const sb = supabaseServidor();

  const { data: filas } = await conColumnas<Record<string, unknown>[]>((cols) => {
    let q = sb.from("products")
      .select(cols)
      .eq("visibilidad", "catalogo")
      .not("slug", "is", null);
    if (!especial) q = q.eq("category_id", id);
    return q.order("created_at", { ascending: false }) as never;
  });

  let productos: Product[] = (filas ?? []).map((f) =>
    productFromDB(f as unknown as Record<string, unknown>)
  );

  if (especial) {
    productos = productos.filter(especial.filtro);
    return { seccion: { id, name: especial.name }, productos, subCategories: [] };
  }

  const { data: cat } = await sb
    .from("categories")
    .select("id, name, subcategories(name, sort_order)")
    .eq("id", id)
    .maybeSingle();

  if (!cat) return null;

  const subs = ((cat.subcategories ?? []) as { name: string; sort_order: number }[])
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((s) => s.name);

  return {
    seccion: { id: cat.id as string, name: cat.name as string },
    productos,
    subCategories: subs,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const datos = await traerSeccion(id);

  if (!datos) return { title: "Sección no encontrada" };

  const { seccion, productos } = datos;
  const nombre = seccion.name.toLowerCase();
  const url = `${urlDelSitio()}/categoria/${id}`;
  const titulo = ESPECIALES[id] ? seccion.name : `Ropa y calzado de ${nombre}`;

  return {
    // La marca la agrega el `title.template` de app/layout.tsx.
    title: titulo,
    description:
      `${productos.length} artículos de ${nombre} con envío a todo el país. ` +
      `Todos los talles, cambios sin cargo y hasta 6 cuotas sin interés.`,
    alternates: { canonical: url },
    openGraph: {
      title: titulo,
      description: `${productos.length} artículos de ${nombre}. Envío a todo el país.`,
      url,
      type: "website",
      siteName: "ARG Indumentaria",
      locale: "es_AR",
      images: ogImagenAbsoluta(),
    },
  };
}

export default async function CategoriaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sub?: string }>;
}) {
  const { id } = await params;
  const { sub } = await searchParams;
  const datos = await traerSeccion(id);

  if (!datos) notFound();

  const { seccion, subCategories } = datos;
  const productos = sub
    ? datos.productos.filter((p) => p.subcategory === sub)
    : datos.productos;

  const migas = jsonLdMigas([
    { nombre: "Inicio", url: urlDelSitio() },
    { nombre: seccion.name, url: `${urlDelSitio()}/categoria/${id}` },
    ...(sub ? [{ nombre: sub, url: `${urlDelSitio()}/categoria/${id}?sub=${encodeURIComponent(sub)}` }] : []),
  ]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: sub ?? seccion.name,
    url: `${urlDelSitio()}/categoria/${id}`,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: productos.length,
      itemListElement: productos.map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${urlDelSitio()}/producto/${p.slug}`,
        name: p.title,
      })),
    },
  };

  return (
    <div className="flex min-h-screen flex-col bg-ink text-chalk">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: ldJson([jsonLd, migas]) }}
      />
      <Header />

      <main className="flex-1">
        <div className="mx-auto w-full max-w-[1320px] px-4 py-8 md:px-6 md:py-12 lg:px-14">

          <nav aria-label="Dónde estás" className="mb-6 flex flex-wrap items-center gap-2 text-[0.85rem] text-dim">
            <Link href="/" className="transition-colors hover:text-chalk">Inicio</Link>
            <span aria-hidden="true">/</span>
            {sub ? (
              <>
                <Link href={`/categoria/${id}`} className="transition-colors hover:text-chalk">
                  {seccion.name}
                </Link>
                <span aria-hidden="true">/</span>
                <span className="text-chalk">{sub}</span>
              </>
            ) : (
              <span className="text-chalk">{seccion.name}</span>
            )}
          </nav>

          <h1 className="font-display text-[clamp(1.8rem,4vw,2.8rem)] font-extrabold uppercase leading-none">
            {sub ?? seccion.name}
          </h1>
          <p className="ag-num mt-3 text-[0.9rem] text-mute">
            {productos.length} {productos.length === 1 ? "artículo" : "artículos"}
          </p>

          {/* Subcategorías: el segundo nivel de la navegación. En el celular se
              arrastran de costado en vez de apilarse en seis renglones. */}
          {subCategories.length > 0 && (
            <div className="ag-carrusel mt-7 gap-2 md:flex-wrap">
              <Link
                href={`/categoria/${id}`}
                className={`whitespace-nowrap border px-4 py-2 font-cond text-[0.8rem] font-semibold uppercase tracking-[0.13em] transition-colors ${
                  !sub ? "border-chalk bg-chalk text-white" : "border-line text-mute hover:border-chalk hover:text-chalk"
                }`}
              >
                Todos
              </Link>
              {subCategories.map((s) => (
                <Link
                  key={s}
                  href={`/categoria/${id}?sub=${encodeURIComponent(s)}`}
                  className={`whitespace-nowrap border px-4 py-2 font-cond text-[0.8rem] font-semibold uppercase tracking-[0.13em] transition-colors ${
                    sub === s ? "border-chalk bg-chalk text-white" : "border-line text-mute hover:border-chalk hover:text-chalk"
                  }`}
                >
                  {s}
                </Link>
              ))}
            </div>
          )}

          {productos.length === 0 ? (
            <div className="mt-12 border border-dashed border-line px-8 py-16 text-center">
              <p className="font-display text-[1.15rem] font-bold">
                Todavía no hay artículos publicados acá
              </p>
              <p className="mt-3 text-mute">
                Que no esté publicado no quiere decir que no lo consigamos.
              </p>
              <Link href="/" className="ag-btn ag-btn-solid mt-6">Ver el catálogo</Link>
            </div>
          ) : (
            <div className="mt-10 grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-3 xl:grid-cols-4">
              {productos.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

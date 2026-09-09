// src/app/producto/[slug]/page.tsx
//
// La página propia de cada producto. Antes de esto el catálogo entero vivía
// en "/" y se filtraba del lado del cliente: para Google el sitio tenía UNA
// página. Acá cada producto pasa a ser una dirección que se puede indexar,
// compartir por WhatsApp y linkear desde afuera.
//
// De servidor a propósito, por tres cosas que sólo se pueden hacer acá:
// generateMetadata (el título y la descripción que muestra Google), el
// JSON-LD, y que el contenido salga ya escrito en el HTML.
//
// Next 16: params es una Promise y hay que await-earla (ver
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md).

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { supabaseServidor, supabaseServidorConfigurado, urlDelSitio } from "@/lib/supabase-server";
import { productFromDB } from "@/lib/supabase";
import { conColumnas } from "@/lib/columnas";
import { products as PRODUCTOS_DE_ARRANQUE } from "@/data/products";
import { categories as CATEGORIAS_DE_ARRANQUE } from "@/data/categories";
import { Product } from "@/types";
import Ficha from "../_ficha";
import { jsonLdMigas, ldJson, ogImagenAbsoluta, absoluta } from "@/lib/seo";

// El catálogo cambia desde el panel y se publica al instante: 5 minutos de
// caché es el equilibrio entre no pegarle a Supabase en cada visita y que un
// cambio de precio no tarde en verse.
export const revalidate = 300;



async function traerProducto(slug: string): Promise<{ producto: Product; rubro?: { id: string; name: string }; actualizado?: string } | null> {
  /* Sin credenciales (un `npm run dev` recién clonado) se usa el catálogo de
     arranque. Antes devolvía null y toda ficha daba 404: no se podía ver ni
     trabajar en la página de producto sin montar la base primero. */
  if (!supabaseServidorConfigurado) {
    const p = PRODUCTOS_DE_ARRANQUE.find((x) => x.slug === slug);
    if (!p) return null;
    const c = CATEGORIAS_DE_ARRANQUE.find((x) => x.id === p.categoryId);
    return {
      producto: p,
      rubro: c ? { id: c.id, name: c.name } : undefined,
      actualizado: undefined,
    };
  }

  const sb = supabaseServidor();

  // La RLS ya esconde los pedidos por encargo de la clave anon; el filtro por
  // visibilidad es el segundo candado, para que esto sea correcto aunque
  // alguien afloje la policy más adelante.
  const { data, error } = await conColumnas<Record<string, unknown>>((cols) =>
    sb.from("products")
      .select(`${cols}, visibilidad`)
      .eq("slug", slug)
      .eq("visibilidad", "catalogo")
      .maybeSingle() as never,
  );

  if (error || !data) return null;

  const producto = productFromDB(data as unknown as Record<string, unknown>);

  let rubro: { id: string; name: string } | undefined;
  if (producto.categoryId) {
    const { data: cat } = await sb
      .from("categories").select("id, name").eq("id", producto.categoryId).maybeSingle();
    if (cat) rubro = { id: cat.id as string, name: cat.name as string };
  }

  // La fecha cruda: productFromDB no la conserva y la necesitamos para el
  // precio (ver priceValidUntil más abajo).
  const actualizado = (data as unknown as Record<string, unknown>).updated_at as
    | string
    | undefined;

  return { producto, rubro, actualizado };
}

/** Lo que muestra Google en el resultado, y lo que se ve al pegar el link
 *  en WhatsApp. Sin esto, todas las páginas comparten el título del sitio. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const encontrado = await traerProducto(slug);

  if (!encontrado) {
    return { title: "Producto no encontrado" };
  }

  const { producto, rubro } = encontrado;

  const titulo = [producto.title, producto.brand].filter(Boolean).join(" · ");
  const descripcion =
    producto.description?.slice(0, 155) ||
    `${producto.title}${producto.brand ? ` ${producto.brand}` : ""}` +
      `${producto.sku ? `, SKU ${producto.sku}` : ""}. ` +
      `${rubro ? `${rubro.name}. ` : ""}Envío a todo el país.`;

  const url = `${urlDelSitio()}/producto/${slug}`;

  return {
    // Sin " — ARG Indumentaria" al final: eso lo agrega solo el
    // `title.template` de app/layout.tsx. Escrito en los dos lados, el
    // título salía con la marca DOS VECES ("... — ARG Indumentaria |
    // ARG Indumentaria") y se comía los ~60 caracteres que Google
    // muestra, que en una ficha valen para el nombre de la prenda.
    title: titulo,
    description: descripcion,
    alternates: { canonical: url },
    openGraph: {
      title: titulo,
      description: descripcion,
      url,
      type: "website",
      siteName: "ARG Indumentaria",
      locale: "es_AR",
      // absoluta(): si la foto viniera con ruta relativa, WhatsApp y
      // Facebook la descartan sin avisar y el link sale sin imagen.
      // Y si el producto todavía no tiene foto cargada —que hoy es la
      // mayoría— se usa la de la marca en vez de no mandar ninguna.
      images: producto.image
        ? [{ url: absoluta(producto.image)!, alt: producto.title }]
        : ogImagenAbsoluta(),
    },
  };
}

export default async function ProductoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const encontrado = await traerProducto(slug);

  if (!encontrado) notFound();

  const { producto, rubro, actualizado } = encontrado;

  // JSON-LD: lo que hace que Google muestre el precio y la disponibilidad
  // en el resultado de búsqueda, en vez de un link pelado.
  const fotos = [
    ...(producto.image ? [producto.image] : []),
    ...(producto.images ?? []),
  ]
    .map((f) => absoluta(f))
    .filter(Boolean) as string[];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: producto.title,
    description: producto.description || undefined,
    // Si no hay ni una foto, el campo NO va: `image: []` le hace decir a
    // Google "falta la imagen" en el informe de productos, y una lista
    // vacía es peor que la ausencia del campo.
    ...(fotos.length ? { image: fotos } : {}),
    sku: producto.id,
    mpn: producto.sku || undefined,
    brand: producto.brand ? { "@type": "Brand", name: producto.brand } : undefined,
    category: rubro?.name,
    // Talles y colores publicados. Google los usa para mostrar la ficha con
    // las variantes y para que el producto entre en búsquedas del tipo
    // "campera de jean talle XL".
    ...(producto.sizes?.length ? { size: producto.sizes } : {}),
    ...(producto.colors?.length ? { color: producto.colors.map((c) => c.name) } : {}),
    ...(producto.material ? { material: producto.material } : {}),
    // Prenda nueva, no usada. Sin este campo Google avisa que falta. Sin este campo Google
    // muestra un aviso en el informe de productos y a veces no arma el
    // resultado enriquecido.
    itemCondition: "https://schema.org/NewCondition",
    offers: {
      "@type": "Offer",
      url: `${urlDelSitio()}/producto/${slug}`,
      priceCurrency: "ARS",
      price: producto.price,
      // Sin fecha de validez Google asume que el precio venció y deja de
      // mostrarlo en el resultado. Se cuenta desde la última vez que se
      // tocó el producto, NO desde "hoy": tomar la hora del reloj durante
      // el render da un valor distinto en cada regeneración, y además
      // eslint lo marca como función impura (react-hooks/purity). Cada vez
      // que Omar edita el precio, la validez se renueva sola 30 días.
      priceValidUntil: new Date(
        (actualizado ? new Date(actualizado) : new Date()).getTime() + 30 * 864e5
      ).toISOString().slice(0, 10),
      availability:
        (producto.stock ?? 0) > 0
          ? "https://schema.org/InStock"
          // OJO: "OutOfStock" le dice a Google "no lo tengo". Acá la
          // verdad es "te lo conseguimos por encargo": eso es BackOrder.
          : "https://schema.org/BackOrder",
      seller: { "@id": `${urlDelSitio()}/#negocio` },
      // Envío a todo el país. Sin esto el resultado de producto sale con
      // el aviso "falta información de envío".
      shippingDetails: {
        "@type": "OfferShippingDetails",
        shippingDestination: {
          "@type": "DefinedRegion",
          addressCountry: "AR",
        },
      },
    },
  };

  // Las migas para Google: el mismo camino Inicio → Categoría → Producto que ya
  // se ve arriba de la ficha. Hace que en el resultado aparezca esa ruta en
  // vez de la dirección cruda, que se lee mucho mejor en el celular.
  const migas = jsonLdMigas([
    { nombre: "Inicio", url: urlDelSitio() },
    ...(rubro ? [{ nombre: rubro.name, url: `${urlDelSitio()}/categoria/${rubro.id}` }] : []),
    { nombre: producto.title, url: `${urlDelSitio()}/producto/${slug}` },
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-ink text-chalk">
      <script
        type="application/ld+json"
        // El contenido sale de nuestra propia base, no de un input del
        // visitante. Igual se escapa "<" para que un título no pueda cerrar
        // la etiqueta script.
        dangerouslySetInnerHTML={{ __html: ldJson([jsonLd, migas]) }}
      />
      <Header />
      <main className="flex-1">
        <Ficha product={producto} rubro={rubro} />
      </main>
      <Footer />
    </div>
  );
}

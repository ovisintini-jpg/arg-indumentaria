// src/lib/seo.ts
//
// Todo lo que se repite en las etiquetas de SEO, en un solo lugar.
//
// POR QUÉ EXISTE: la imagen de compartir, el nombre del sitio y la ficha del
// negocio se usan en cuatro archivos distintos. Cuando estaban copiados a
// mano pasaba lo de siempre: se corregía en uno y quedaba viejo en los otros.
//
// OJO CON LAS URLs: Facebook, WhatsApp y Google exigen que og:image sea una
// dirección ABSOLUTA (https://...). Una relativa —"/images/og.jpg"— se
// descarta en silencio: no da error, simplemente el link se comparte sin
// imagen. Por eso está absoluta().

import { urlDelSitio } from "@/lib/supabase-server";

export const NOMBRE_SITIO = "ARG Indumentaria";

/** La imagen que se ve al pegar un link en WhatsApp, Instagram o Facebook.
 *  1200 × 630 es la medida que piden todos; más chica se ve borrosa y más
 *  grande la recortan igual. */
export const OG_IMAGEN = {
  url: "/images/og-default.jpg",
  width: 1200,
  height: 630,
  alt: "ARG Indumentaria — ropa y calzado para toda la familia",
};

/** Convierte "/images/x.jpg" en "https://elsitio/images/x.jpg".
 *  Si ya viene absoluta (las fotos de producto viven en Supabase) la deja. */
export function absoluta(ruta: string | undefined | null): string | undefined {
  if (!ruta) return undefined;
  if (/^https?:\/\//i.test(ruta)) return ruta;
  return `${urlDelSitio()}${ruta.startsWith("/") ? "" : "/"}${ruta}`;
}

/** La imagen de compartir, lista para meter en `openGraph.images`. */
export function ogImagenAbsoluta() {
  return [{ ...OG_IMAGEN, url: absoluta(OG_IMAGEN.url)! }];
}

// ── Datos estructurados ──────────────────────────────────────────
//
// El JSON-LD es cómo se le explica a Google qué es esto sin que tenga que
// adivinarlo del texto. No cambia lo que ve el visitante: cambia cómo se ve
// el resultado en el buscador (migas en vez de una URL pelada, el precio y
// el stock abajo del título) y ayuda a que Google entienda que detrás hay
// un negocio real y no una página suelta.

interface DatosContacto {
  email?: string;
  telefono?: string;
  instagram?: string;
  facebook?: string;
}

/** Descarta los valores de relleno que todavía están en la base
 *  (`+54 9 351 000-0000`, `tu-email@ejemplo.com`). Publicar un teléfono
 *  inventado en los datos estructurados es peor que no publicar ninguno:
 *  Google lo puede mostrar en el resultado y alguien lo va a marcar. */
function real(valor?: string): string | undefined {
  if (!valor) return undefined;
  const v = valor.trim();
  if (!v) return undefined;
  if (/000[\s-]?0000|ejemplo|example|xxxx/i.test(v)) return undefined;
  return v;
}

/** La ficha del negocio. Va sólo en la home: repetirla en cada página no
 *  suma nada y Google prefiere una sola fuente. */
export function jsonLdOrganizacion(contacto: DatosContacto = {}) {
  const base = urlDelSitio();

  const redes = [
    real(contacto.instagram) &&
      `https://www.instagram.com/${contacto.instagram!.replace("@", "")}`,
    real(contacto.facebook) &&
      `https://www.facebook.com/${contacto.facebook}`,
  ].filter(Boolean) as string[];

  const email = real(contacto.email);
  const telefono = real(contacto.telefono);

  return {
    "@context": "https://schema.org",
    "@type": "ClothingStore",
    "@id": `${base}/#negocio`,
    name: NOMBRE_SITIO,
    url: base,
    image: absoluta(OG_IMAGEN.url),
    description:
      "Indumentaria y calzado para mujer, hombre y chicos. Temporada, básicos " +
      "y outlet, con envíos a todo el país y cambios sin cargo.",
    // El negocio vende a todo el país, no atiende en un mostrador. Sin
    // dirección física NO se pone `address` inventada: Google penaliza los
    // datos de local que no coinciden con la realidad.
    areaServed: { "@type": "Country", name: "Argentina" },
    currenciesAccepted: "ARS",
    ...(redes.length ? { sameAs: redes } : {}),
    ...(email || telefono
      ? {
          contactPoint: {
            "@type": "ContactPoint",
            contactType: "sales",
            availableLanguage: "Spanish",
            ...(email ? { email } : {}),
            ...(telefono ? { telephone: telefono } : {}),
          },
        }
      : {}),
  };
}

/** Le dice a Google que el buscador del sitio existe. Con el tiempo puede
 *  hacer que en el resultado aparezca una cajita para buscar adentro de
 *  ARG Indumentaria sin entrar. */
export function jsonLdSitio() {
  const base = urlDelSitio();
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${base}/#sitio`,
    name: NOMBRE_SITIO,
    url: base,
    inLanguage: "es-AR",
    publisher: { "@id": `${base}/#negocio` },
  };
}

/** Las migas: Inicio → Categoría → Producto. Es lo que hace que Google muestre
 *  ese camino abajo del título en vez de la URL cruda. Los pasos ya estaban
 *  dibujados en la pantalla; esto es la versión que lee el buscador. */
export function jsonLdMigas(pasos: { nombre: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: pasos.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: p.nombre,
      item: p.url,
    })),
  };
}

/** Serializa para meter adentro de un <script type="application/ld+json">.
 *  El escape de "<" es obligatorio: sin él, un título que contenga "</script>"
 *  cierra la etiqueta y rompe la página. El contenido sale de nuestra base,
 *  pero la base la cargan personas. */
export function ldJson(dato: unknown): string {
  return JSON.stringify(dato).replace(/</g, "\\u003c");
}

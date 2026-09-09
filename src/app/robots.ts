import { MetadataRoute } from "next";

// La dirección sale de urlDelSitio(): NEXT_PUBLIC_SITE_URL si está cargada,
// si no el dominio del deploy de Vercel. Antes esto caía siempre en el
// dominio propio aunque el sitio todavía no estuviera ahí, y un sitemap que
// declara URLs de otro dominio Google lo descarta entero.
import { urlDelSitio } from "@/lib/supabase-server";

const baseUrl = urlDelSitio();

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // /pedido-especial/ son las cotizaciones privadas: un link por cliente. No van
        // al sitemap y cada página además manda robots: noindex.
        disallow: ["/admin/", "/checkout", "/mi-cuenta", "/reset-password", "/pedido-especial/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}

// src/app/sitemap.ts
//
// El mapa que le damos a Google. Hasta el 05/09 tenía dos direcciones —la
// home y arrepentimiento— porque no había ninguna otra página: el catálogo
// entero se filtraba del lado del cliente. Ahora lista cada repuesto y cada
// rubro.
//
// Las piezas a pedido (/pedido-especial/<token>) NO van acá y no van a ir nunca: son
// privadas, una por cliente. Además de no estar en este archivo, cada una
// manda robots: noindex y /pedido-especial/ está bloqueado en robots.ts. La consulta de
// abajo usa la clave anon, así que la RLS ya las deja afuera sola — son tres
// candados para la misma puerta, a propósito.

import { MetadataRoute } from "next";
import { supabaseServidor, supabaseServidorConfigurado, urlDelSitio } from "@/lib/supabase-server";

// Que no se quede pegado un sitemap viejo cuando cargás repuestos nuevos.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = urlDelSitio();

  const fijas: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      // Obligatoria por la Resolución 424/2020 y accesible sin login.
      url: `${baseUrl}/arrepentimiento`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  if (!supabaseServidorConfigurado) return fijas;

  try {
    const sb = supabaseServidor();

    const [{ data: productos, error: errProductos }, { data: rubros, error: errRubros }] =
      await Promise.all([
      sb.from("products")
        // `image` va acá para el sitemap de imágenes: es lo que le abre a
        // los repuestos la puerta de Google Imágenes, que en autopartes
        // mueve más de lo que parece —mucha gente busca la pieza mirando,
        // porque no sabe cómo se llama.
        .select("slug, updated_at, image, title")
        .eq("visibilidad", "catalogo")
        .not("slug", "is", null),
      sb.from("categories").select("id").order("sort_order"),
    ]);

    // supabase-js NO tira una excepción cuando la consulta falla: devuelve el
    // error adentro del resultado. Sin estas dos líneas el sitemap salía con
    // los rubros y sin un solo producto, sin dejar rastro en ningún lado.
    // Pasó el 05/09 —faltaba correr el parche de slugs— y desde afuera parecía
    // que las URLs estaban rotas en vez de que faltaba el script.
    if (errProductos) console.error("[sitemap] no se pudieron leer los repuestos:", errProductos.message);
    if (errRubros)    console.error("[sitemap] no se pudieron leer los rubros:", errRubros.message);

    const deRubros: MetadataRoute.Sitemap = (rubros ?? []).map((r) => ({
      url: `${baseUrl}/categoria/${r.id as string}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

    const deProductos: MetadataRoute.Sitemap = (productos ?? []).map((p) => {
      const foto = p.image as string | null;
      return {
        url: `${baseUrl}/producto/${p.slug as string}`,
        lastModified: p.updated_at ? new Date(p.updated_at as string) : new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.7,
        // Sólo las que ya son direcciones absolutas: una ruta relativa acá
        // hace que Google descarte la entrada de imagen entera.
        ...(foto && /^https?:\/\//i.test(foto) ? { images: [foto] } : {}),
      };
    });

    return [...fijas, ...deRubros, ...deProductos];
  } catch (err) {
    // Un sitemap incompleto es mucho mejor que un 500: si Supabase no
    // contesta, Google se lleva al menos la home.
    console.error("[sitemap] no se pudo leer el catálogo:", err);
    return fijas;
  }
}

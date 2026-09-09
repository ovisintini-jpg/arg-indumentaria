// src/lib/catalogo-servidor.ts
//
// Lee el catálogo DEL LADO DEL SERVIDOR, para que la home salga del horno ya
// con los repuestos escritos en el HTML.
//
// EL PROBLEMA QUE RESUELVE (comprobado mirando el HTML servido, no deducido):
// ProductsContext y CatalogCategoriesContext arrancan con listas vacías y se
// llenan en un useEffect. Eso significa que el HTML que sale del servidor no
// tiene ni un repuesto ni un rubro: la página llega vacía y recién se dibuja
// cuando el navegador ejecuta JavaScript. Para el visitante es medio segundo
// de grilla gris. Para Google, que no siempre ejecuta JavaScript, es una home
// sin contenido — y desde que se sacó LinksCatalogo (08/09) era, literalmente,
// una home sin un solo link a un repuesto.
//
// La solución es sembrar: el servidor trae los datos una vez y se los pasa a
// los contextos como valor inicial. Los contextos siguen refrescando solos en
// el navegador, así que un precio que cambia se sigue viendo al toque.
//
// Se usa desde app/layout.tsx, que es un componente de servidor.

import { supabaseServidor, supabaseServidorConfigurado } from "@/lib/supabase-server";
import { productFromDB } from "@/lib/supabase";
import { Category, Especial, Product } from "@/types";
import {
  categories as RUBROS_DE_ARRANQUE,
  especiales as DESTACADOS_DE_ARRANQUE,
} from "@/data/categories";
import { products as CATALOGO_DE_ARRANQUE } from "@/data/products";

export interface CatalogoSembrado {
  productos: Product[];
  rubros: Category[];
  especiales: Especial[];
}

import { conColumnas } from "@/lib/columnas";

/** Trae rubros y repuestos. Nunca tira: si algo falla devuelve listas vacías y
 *  los contextos hacen lo de siempre —cargar desde el navegador—, así que lo
 *  peor que puede pasar es volver a como estaba antes. */
export async function traerCatalogoServidor(): Promise<CatalogoSembrado> {
  const vacio: CatalogoSembrado = { productos: [], rubros: [], especiales: [] };

  // Sin credenciales (el `npm run dev` de una máquina recién clonada) se
  // siembran los mismos datos de arranque que usan los contextos. Así lo que
  // se ve en pantalla es idéntico antes y después de hidratar, que es la
  // condición para que React no tire un error de hidratación.
  if (!supabaseServidorConfigurado) {
    return {
      productos: CATALOGO_DE_ARRANQUE,
      rubros: RUBROS_DE_ARRANQUE,
      especiales: DESTACADOS_DE_ARRANQUE,
    };
  }

  try {
    const sb = supabaseServidor();

    const [{ data: filas }, { data: cats }, { data: esps }] = await Promise.all([
      // Los pedidos por encargo son privados: uno por cliente. La RLS ya los
      // esconde de la clave anon; este filtro es el segundo candado.
      conColumnas<Record<string, unknown>[]>((cols) =>
        sb.from("products")
          .select(cols)
          .eq("visibilidad", "catalogo")
          .order("created_at", { ascending: false }) as never,
      ),
      sb.from("categories")
        .select("id, name, sort_order, subcategories(name, sort_order)")
        .order("sort_order"),
      sb.from("especiales").select("id, name, sort_order").order("sort_order"),
    ]);

    return {
      productos: (filas ?? []).map((f) =>
        productFromDB(f as unknown as Record<string, unknown>)
      ),
      rubros: (cats ?? []).map(
        (c: {
          id: string;
          name: string;
          subcategories: { name: string; sort_order: number }[];
        }) => ({
          id: c.id,
          name: c.name,
          subCategories: (c.subcategories ?? [])
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((s) => s.name),
        })
      ),
      especiales: (esps ?? []).map((e: { id: string; name: string }) => ({
        id: e.id,
        name: e.name,
      })),
    };
  } catch (err) {
    console.error("[catalogo-servidor] no se pudo sembrar el catálogo:", err);
    return vacio;
  }
}

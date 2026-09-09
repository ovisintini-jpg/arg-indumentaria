// src/components/LinksCatalogo.tsx
//
// El camino que Google necesita para entrar al catálogo.
//
// POR QUÉ EXISTE — se descubrió probando el HTML que sirve el servidor:
// la home tenía CERO links a productos. No por un olvido, sino porque el
// catálogo lo carga ProductsContext en un useEffect: en el HTML que sale del
// servidor la grilla está vacía y las tarjetas aparecen recién después de
// hidratar. Un buscador que no ejecuta JavaScript —o que lo ejecuta tarde y
// de mala gana, que es lo normal— no ve un solo repuesto.
//
// Hacer linkeables las tarjetas (ProductCard) no alcanzaba: esos links
// tampoco están en el HTML. Este bloque sí, porque es un componente de
// SERVIDOR: consulta Supabase y escribe los <a> directo en la página.
//
// De paso le sirve al cliente: es el índice de todo lo que hay, sin tener
// que adivinar el buscador.

import Link from "next/link";
import { supabaseServidor, supabaseServidorConfigurado } from "@/lib/supabase-server";

// Cuántos repuestos se listan por rubro. Con más, el bloque se vuelve
// interminable y el link que importa (el del rubro) se pierde.
const POR_RUBRO = 12;

// Acá NO va un `export const revalidate`: Next sólo lo lee de los archivos de
// ruta. En un componente se ignora sin avisar, y da la falsa sensación de que
// el bloque se refresca solo. El que manda es el de src/app/page.tsx.

interface Fila {
  slug: string;
  title: string;
  category_id: string | null;
}

interface Rubro { id: string; name: string }

/** Trae los datos. Separado del render a propósito: el JSX no puede vivir
 *  adentro de un try/catch — React no lo evalúa ahí, así que ese catch nunca
 *  atraparía un error de renderizado y da una falsa sensación de red. */
async function traerCatalogo(): Promise<{ rubros: Rubro[]; porRubro: Map<string, Fila[]> } | null> {
  if (!supabaseServidorConfigurado) return null;

  try {
    const sb = supabaseServidor();

    const [{ data: rubros }, { data: productos }] = await Promise.all([
      sb.from("categories").select("id, name").order("sort_order"),
      sb.from("products")
        .select("slug, title, category_id")
        .eq("visibilidad", "catalogo")
        .not("slug", "is", null)
        .order("created_at", { ascending: false }),
    ]);

    if (!rubros?.length) return null;

    const porRubro = new Map<string, Fila[]>();
    for (const p of (productos ?? []) as unknown as Fila[]) {
      const key = p.category_id ?? "";
      if (!porRubro.has(key)) porRubro.set(key, []);
      porRubro.get(key)!.push(p);
    }

    return { rubros: rubros as Rubro[], porRubro };
  } catch (err) {
    // Que la home no se caiga si Supabase no contesta: este bloque es un
    // agregado, no el contenido principal.
    console.error("[LinksCatalogo] no se pudo leer el catálogo:", err);
    return null;
  }
}

export default async function LinksCatalogo() {
  const datos = await traerCatalogo();
  if (!datos) return null;

  const { rubros, porRubro } = datos;

  const conProductos = rubros.filter((r) => (porRubro.get(r.id)?.length ?? 0) > 0);
  if (!conProductos.length) return null;

  return (
    <section
      aria-label="Todo el catálogo"
      className="border-t border-line bg-[#0B0D10]"
    >
      <div className="mx-auto w-full max-w-[1400px] px-6 py-14 lg:px-10">
        <div className="ag-tick mb-4" aria-hidden="true"><i /><i /><i /></div>
        <h2 className="font-display text-[1.3rem] font-extrabold uppercase tracking-[-0.02em]">
          Todo el catálogo
        </h2>
        <p className="ag-label mt-3">Entrá directo a lo que buscás</p>

        <div className="mt-10 grid grid-cols-1 gap-x-10 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
          {conProductos.map((r) => {
            const items = porRubro.get(r.id) ?? [];
            const visibles = items.slice(0, POR_RUBRO);
            const restantes = items.length - visibles.length;

            return (
              <div key={r.id}>
                <h3 className="border-b border-line pb-2.5">
                  <Link
                    href={`/categoria/${r.id}`}
                    className="font-cond text-[0.8rem] font-semibold uppercase tracking-[0.18em] text-chalk transition-colors hover:text-acentohi"
                  >
                    {r.name}
                  </Link>
                </h3>

                <ul className="mt-3.5 space-y-2">
                  {visibles.map((p) => (
                    <li key={p.slug}>
                      <Link
                        href={`/producto/${p.slug}`}
                        className="text-[0.87rem] font-light leading-snug text-mute transition-colors hover:text-chalk"
                      >
                        {p.title}
                      </Link>
                    </li>
                  ))}
                </ul>

                {restantes > 0 && (
                  <Link
                    href={`/categoria/${r.id}`}
                    className="ag-label mt-3.5 inline-block transition-colors hover:text-chalk"
                  >
                    Ver los {items.length} de {r.name.toLowerCase()} →
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

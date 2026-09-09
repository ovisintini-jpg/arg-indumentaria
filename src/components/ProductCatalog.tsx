"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useCategory } from "@/context/CategoryContext";
import { useQuote } from "@/context/QuoteContext";
import { useProducts } from "@/context/ProductsContext";
import { useCatalogCategories } from "@/context/CatalogCategoriesContext";
import { ProductCard } from "@/components/ProductCard";
import { Icon } from "@/components/Icons";
import { Product } from "@/types";

const POR_PAGINA = 24;

type Orden = "relevancia" | "precio-asc" | "precio-desc" | "alfabetico" | "novedades";

const ORDENES: { id: Orden; label: string }[] = [
  { id: "relevancia",  label: "Más relevantes" },
  { id: "novedades",   label: "Novedades primero" },
  { id: "precio-asc",  label: "Precio: menor a mayor" },
  { id: "precio-desc", label: "Precio: mayor a menor" },
  { id: "alfabetico",  label: "Nombre A–Z" },
];

function paginas(actual: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const desde = Math.max(2, actual - 2);
  const hasta = Math.min(total - 1, actual + 2);
  if (desde > 2) out.push("…");
  for (let i = desde; i <= hasta; i++) out.push(i);
  if (hasta < total - 1) out.push("…");
  out.push(total);
  return out;
}

const normalizar = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const money = (n: number) => `$${n.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;

/* El orden natural de los talles. Sin esto, la lista de filtros sale en el
   orden en que aparecieron los productos y quedan cosas como "L, XS, M, S". */
const ORDEN_TALLE = ["RN","0-3 M","3-6 M","6-9 M","9-12 M","12-18 M","18-24 M",
                     "XXS","XS","S","M","L","XL","XXL","XXXL","Único"];
function compararTalles(a: string, b: string) {
  const ia = ORDEN_TALLE.indexOf(a);
  const ib = ORDEN_TALLE.indexOf(b);
  if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  const na = Number(a); const nb = Number(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  return a.localeCompare(b, "es");
}

/* ───────────────────────────────────────────────────────────────────────────
   EL LISTADO

   La diferencia con la versión de autopartes son los FILTROS. En repuestos el
   cliente llega buscando una pieza puntual y con la categoría alcanza; en
   indumentaria llega a mirar y necesita achicar: mi talle, mi color, hasta
   tanta plata. Un listado de ropa sin filtro de talle obliga a abrir prenda
   por prenda para descubrir que no está el talle — y ahí se va el cliente.

   En escritorio los filtros van en una columna a la izquierda, siempre a la
   vista (Nordstrom, DSW, Adidas). En el celular van en un cajón que se abre
   desde un botón fijo, porque una columna de filtros en 360 px empuja el
   producto abajo de todo.
   ─────────────────────────────────────────────────────────────────────────── */

export default function ProductCatalog() {
  const { categoryId, subcategory, setCategory, searchQuery, setSearchQuery } = useCategory();
  const { abrirCotizador } = useQuote();
  const { products, loading } = useProducts();
  const { categories, especiales } = useCatalogCategories();

  const [page, setPage] = useState(1);
  const [orden, setOrden] = useState<Orden>("relevancia");
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);

  const [talles, setTalles]   = useState<string[]>([]);
  const [colores, setColores] = useState<string[]>([]);
  const [marcas, setMarcas]   = useState<string[]>([]);
  const [soloOferta, setSoloOferta] = useState(false);
  const [precioMax, setPrecioMax] = useState<number | null>(null);

  const enBusqueda = searchQuery.trim() !== "";
  const rubro = categories.find((c) => c.id === categoryId);
  const destacado = especiales.find((e) => e.id === categoryId);

  /* Primer recorte: categoría o búsqueda. De acá salen las opciones de filtro,
     así el panel muestra sólo los talles y colores que existen en esta lista y
     no los del catálogo entero. */
  const base = useMemo(() => {
    if (enBusqueda) {
      const q = normalizar(searchQuery.trim());
      return products.filter((p) =>
        normalizar(p.title).includes(q) ||
        normalizar(p.description ?? "").includes(q) ||
        normalizar(p.subcategory ?? "").includes(q) ||
        normalizar(p.brand ?? "").includes(q) ||
        normalizar(p.sku ?? "").includes(q) ||
        (p.colors ?? []).some((c) => normalizar(c.name).includes(q))
      );
    }

    if (!categoryId || categoryId === "todos") return products;
    if (categoryId === "exclusivos") return products.filter((p) => p.isExclusive);
    if (categoryId === "novedades")  return products.filter((p) => p.isNew);
    if (categoryId === "outlet")     return products.filter((p) => p.isOutlet);

    let out = products.filter((p) => p.categoryId === categoryId);
    if (subcategory) out = out.filter((p) => p.subcategory === subcategory);
    return out;
  }, [products, categoryId, subcategory, searchQuery, enBusqueda]);

  const opciones = useMemo(() => {
    const t = new Set<string>();
    const c = new Map<string, string>();
    const m = new Set<string>();
    let maxPrecio = 0;
    for (const p of base) {
      (p.sizes ?? []).forEach((s) => t.add(s));
      (p.colors ?? []).forEach((col) => c.set(col.name, col.hex));
      if (p.brand) m.add(p.brand);
      if (p.price > maxPrecio) maxPrecio = p.price;
    }
    return {
      talles: [...t].sort(compararTalles),
      colores: [...c.entries()].map(([name, hex]) => ({ name, hex })),
      marcas: [...m].sort((a, b) => a.localeCompare(b, "es")),
      maxPrecio: Math.ceil(maxPrecio / 10000) * 10000,
    };
  }, [base]);

  const filtrados = useMemo(() => {
    return base.filter((p) => {
      if (talles.length && !(p.sizes ?? []).some((s) => talles.includes(s))) return false;
      if (colores.length && !(p.colors ?? []).some((c) => colores.includes(c.name))) return false;
      if (marcas.length && !(p.brand && marcas.includes(p.brand))) return false;
      if (soloOferta && !p.isOutlet && !p.price_before) return false;
      if (precioMax !== null && p.price > precioMax) return false;
      return true;
    });
  }, [base, talles, colores, marcas, soloOferta, precioMax]);

  const ordenados = useMemo(() => {
    const out = [...filtrados];
    if (orden === "precio-asc")  out.sort((a, b) => a.price - b.price);
    if (orden === "precio-desc") out.sort((a, b) => b.price - a.price);
    if (orden === "alfabetico")  out.sort((a, b) => a.title.localeCompare(b.title, "es"));
    if (orden === "novedades")   out.sort((a, b) => Number(!!b.isNew) - Number(!!a.isNew));
    return out;
  }, [filtrados, orden]);

  useEffect(() => { setPage(1); }, [categoryId, subcategory, searchQuery, orden, talles, colores, marcas, soloOferta, precioMax]);

  const totalPaginas = Math.ceil(ordenados.length / POR_PAGINA);
  const visibles = ordenados.slice((page - 1) * POR_PAGINA, page * POR_PAGINA);

  const titulo = enBusqueda
    ? `“${searchQuery.trim()}”`
    : destacado?.name ?? rubro?.name ?? "Todo el catálogo";

  const antetitulo = enBusqueda
    ? "Resultados de búsqueda"
    : subcategory
    ? rubro?.name ?? "Categoría"
    : destacado
    ? "Selección"
    : "Catálogo";

  const limpiarTodo = () => {
    setSearchQuery("");
    setCategory(null, null, "HOME");
  };

  const limpiarFiltros = () => {
    setTalles([]); setColores([]); setMarcas([]); setSoloOferta(false); setPrecioMax(null);
  };

  const activos =
    talles.length + colores.length + marcas.length + (soloOferta ? 1 : 0) + (precioMax !== null ? 1 : 0);

  const alternar = (lista: string[], set: (v: string[]) => void, valor: string) =>
    set(lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor]);

  const btnPag = "grid h-9 w-9 place-items-center border text-[0.82rem] transition-colors ag-num";

  // ── El panel de filtros, uno solo, que se dibuja en dos lugares ──
  const panelFiltros = (
    <div className="flex flex-col gap-8">
      {opciones.talles.length > 0 && (
        <div>
          <p className="ag-label mb-3">Talle</p>
          <div className="flex flex-wrap gap-1.5">
            {opciones.talles.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={talles.includes(t)}
                onClick={() => alternar(talles, setTalles, t)}
                className="ag-talle !h-9 !min-w-[42px] !text-[0.82rem]"
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      )}

      {opciones.colores.length > 0 && (
        <div>
          <p className="ag-label mb-3">Color</p>
          <div className="flex flex-wrap gap-2.5">
            {opciones.colores.map((c) => (
              <button
                key={c.name}
                type="button"
                title={c.name}
                aria-label={c.name}
                aria-pressed={colores.includes(c.name)}
                onClick={() => alternar(colores, setColores, c.name)}
                className="ag-color"
                style={{ background: c.hex }}
              />
            ))}
          </div>
        </div>
      )}

      {opciones.marcas.length > 1 && (
        <div>
          <p className="ag-label mb-3">Marca</p>
          <ul className="flex flex-col gap-2">
            {opciones.marcas.map((m) => (
              <li key={m}>
                <label className="flex cursor-pointer items-center gap-2.5 text-[0.9rem] text-mute hover:text-chalk">
                  <input
                    type="checkbox"
                    checked={marcas.includes(m)}
                    onChange={() => alternar(marcas, setMarcas, m)}
                    className="h-4 w-4 accent-[#14120F]"
                  />
                  {m}
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      {opciones.maxPrecio > 0 && (
        <div>
          <p className="ag-label mb-3">Precio hasta</p>
          <input
            type="range"
            min={0}
            max={opciones.maxPrecio}
            step={5000}
            value={precioMax ?? opciones.maxPrecio}
            onChange={(e) => {
              const v = Number(e.target.value);
              setPrecioMax(v >= opciones.maxPrecio ? null : v);
            }}
            className="w-full accent-[#14120F]"
          />
          <p className="ag-num mt-2 text-[0.86rem] text-mute">
            {precioMax === null ? `Sin tope (${money(opciones.maxPrecio)})` : money(precioMax)}
          </p>
        </div>
      )}

      <div>
        <label className="flex cursor-pointer items-center gap-2.5 text-[0.9rem] text-mute hover:text-chalk">
          <input
            type="checkbox"
            checked={soloOferta}
            onChange={() => setSoloOferta((v) => !v)}
            className="h-4 w-4 accent-[#C1272D]"
          />
          Sólo ofertas
        </label>
      </div>

      {activos > 0 && (
        <button
          type="button"
          onClick={limpiarFiltros}
          className="self-start font-cond text-[0.82rem] font-semibold uppercase tracking-[0.14em] text-dim underline underline-offset-4 transition-colors hover:text-sale"
        >
          Borrar filtros ({activos})
        </button>
      )}
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-[1320px] px-4 py-8 md:px-6 md:py-12 lg:px-14">

      {/* Migas */}
      <nav aria-label="Dónde estoy" className="mb-6 flex flex-wrap items-center gap-2 text-[0.85rem] text-dim">
        <Link href="/" onClick={limpiarTodo} className="transition-colors hover:text-chalk">Inicio</Link>
        <span aria-hidden="true">/</span>
        {rubro && subcategory ? (
          <>
            <button type="button" onClick={() => setCategory(rubro.id, null, rubro.name)} className="transition-colors hover:text-chalk">
              {rubro.name}
            </button>
            <span aria-hidden="true">/</span>
            <span className="text-chalk">{subcategory}</span>
          </>
        ) : (
          <span className="text-chalk">{titulo}</span>
        )}
      </nav>

      {/* Encabezado */}
      <div className="mb-7 flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="ag-eyebrow mb-2.5">{antetitulo}</p>
          <h1 className="font-display text-[clamp(1.7rem,3.4vw,2.7rem)] font-extrabold">
            {subcategory ?? titulo}
          </h1>
          <p className="ag-num mt-2 text-[0.9rem] text-mute">
            {loading ? "Cargando…" : `${ordenados.length} ${ordenados.length === 1 ? "artículo" : "artículos"}`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFiltrosAbiertos(true)}
            className="ag-btn ag-btn-ghost ag-btn-sm lg:hidden"
          >
            <Icon name="filtro" size={16} /> Filtros{activos > 0 ? ` (${activos})` : ""}
          </button>

          {/* La flecha va ENCIMA del select, no al lado, para que tocarla abra
              la lista igual que tocar el texto. */}
          <label className="relative flex items-center gap-2.5 border border-line px-4 py-2.5">
            <span className="ag-label hidden sm:block">Ordenar</span>
            <select
              value={orden}
              onChange={(e) => setOrden(e.target.value as Orden)}
              aria-label="Ordenar resultados"
              className="cursor-pointer appearance-none bg-transparent pr-6 text-[0.9rem] font-medium text-chalk outline-none"
            >
              {ORDENES.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-dim">
              <Icon name="chev" size={15} />
            </span>
          </label>
        </div>
      </div>

      {/* Subcategorías de la categoría elegida */}
      {rubro && rubro.subCategories.length > 0 && (
        <div className="ag-carrusel mb-8 gap-2 md:flex-wrap">
          <button
            type="button"
            onClick={() => setCategory(rubro.id, null, rubro.name)}
            className={`border px-4 py-2 font-cond text-[0.8rem] font-semibold uppercase tracking-[0.13em] transition-colors ${
              !subcategory ? "border-chalk bg-chalk text-white" : "border-line text-mute hover:border-chalk hover:text-chalk"
            }`}
          >
            Todos
          </button>
          {rubro.subCategories.map((sub) => (
            <button
              key={sub}
              type="button"
              onClick={() => setCategory(rubro.id, sub, sub)}
              className={`whitespace-nowrap border px-4 py-2 font-cond text-[0.8rem] font-semibold uppercase tracking-[0.13em] transition-colors ${
                subcategory === sub ? "border-chalk bg-chalk text-white" : "border-line text-mute hover:border-chalk hover:text-chalk"
              }`}
            >
              {sub}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-10">
        {/* Columna de filtros — escritorio */}
        <aside className="hidden w-[224px] shrink-0 lg:block">
          <div className="sticky top-[104px]">
            <p className="mb-5 font-display text-[1rem] font-bold uppercase tracking-[-0.01em]">Filtrar</p>
            {panelFiltros}
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          {loading ? (
            <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-3 xl:grid-cols-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="aspect-[3/4] animate-pulse border border-line bg-panel" />
              ))}
            </div>
          ) : visibles.length > 0 ? (
            <section
              aria-label={`Artículos — ${titulo}`}
              className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-3 xl:grid-cols-4"
            >
              {visibles.map((prod: Product) => (
                <ProductCard key={prod.id} product={prod} />
              ))}
            </section>
          ) : (
            <div className="flex flex-col items-center border border-dashed border-line px-6 py-20 text-center">
              <span className="mb-6 text-linehi"><Icon name="search" size={44} /></span>
              <p className="font-display text-[1.15rem] font-bold">
                {activos > 0
                  ? "Ningún artículo con esos filtros"
                  : enBusqueda
                  ? `No lo tenemos publicado: “${searchQuery.trim()}”`
                  : "Todavía no hay artículos en esta sección"}
              </p>
              <p className="mt-3 max-w-[46ch] text-[0.93rem] text-mute">
                {activos > 0
                  ? "Probá sacando un filtro, o pedinos el talle: si no está publicado, lo buscamos."
                  : enBusqueda
                  ? "Que no esté en el catálogo no quiere decir que no lo consigamos. Contanos qué buscás."
                  : "Estamos cargando temporada. Mientras tanto, mirá las otras secciones."}
              </p>

              <div className="mt-8 flex flex-wrap justify-center gap-3">
                {activos > 0 && (
                  <button type="button" onClick={limpiarFiltros} className="ag-btn ag-btn-solid ag-btn-sm">
                    Borrar filtros
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => abrirCotizador(enBusqueda ? { producto: searchQuery.trim() } : {})}
                  className="ag-btn ag-btn-ghost ag-btn-sm"
                >
                  Pedir por encargo <Icon name="arrow" size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Paginación */}
          {totalPaginas > 1 && (
            <nav aria-label="Paginación" className="mt-14 flex select-none items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                aria-label="Página anterior"
                className={`${btnPag} border-line text-mute hover:border-chalk hover:text-chalk disabled:cursor-not-allowed disabled:text-dim disabled:hover:border-line`}
              >
                <span className="rotate-180"><Icon name="arrow" size={16} /></span>
              </button>

              {paginas(page, totalPaginas).map((p, i) =>
                p === "…" ? (
                  <span key={`e${i}`} className="grid h-9 w-9 place-items-center text-dim">…</span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p as number)}
                    aria-current={page === p ? "page" : undefined}
                    className={`${btnPag} ${
                      page === p ? "border-chalk bg-chalk text-white" : "border-line text-mute hover:border-chalk hover:text-chalk"
                    }`}
                  >
                    {p}
                  </button>
                )
              )}

              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPaginas, p + 1))}
                disabled={page === totalPaginas}
                aria-label="Página siguiente"
                className={`${btnPag} border-line text-mute hover:border-chalk hover:text-chalk disabled:cursor-not-allowed disabled:text-dim disabled:hover:border-line`}
              >
                <Icon name="arrow" size={16} />
              </button>
            </nav>
          )}
        </div>
      </div>

      {/* Cajón de filtros — celular */}
      {filtrosAbiertos && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-chalk/35"
            onClick={() => setFiltrosAbiertos(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 flex w-[86%] max-w-[360px] flex-col bg-ink">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <p className="font-display text-[1.05rem] font-bold uppercase">Filtrar</p>
              <button
                type="button"
                onClick={() => setFiltrosAbiertos(false)}
                aria-label="Cerrar filtros"
                className="text-mute"
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            <div className="custom-scrollbar flex-1 overflow-y-auto px-5 py-6">{panelFiltros}</div>
            <div className="border-t border-line p-4">
              <button
                type="button"
                onClick={() => setFiltrosAbiertos(false)}
                className="ag-btn ag-btn-solid w-full"
              >
                Ver {ordenados.length} artículos
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

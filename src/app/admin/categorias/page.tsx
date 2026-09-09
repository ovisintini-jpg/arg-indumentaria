"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useCatalogCategories } from "@/context/CatalogCategoriesContext";
import {
  Page, PageHead, StatRow, Stat, Panel, Btn, Input, Badge,
  Empty, ErrorState, Loading, Confirm, Note, Msg, SIN_RESPUESTA,
} from "@/components/admin/ui";

interface SubcatRow { id: string; name: string; sort_order: number; }
interface CatRow    { id: string; name: string; sort_order: number; subcategories: SubcatRow[]; }

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function CategoriasPage() {
  const { refreshCatalog } = useCatalogCategories();

  const [cats,    setCats]    = useState<CatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [newSub,  setNewSub]  = useState<Record<string, string>>({});
  const [error,   setError]   = useState("");
  const [loadError, setLoadError] = useState("");

  const [newCatName, setNewCatName] = useState("");
  const [addingCat,  setAddingCat]  = useState(false);
  const [showNewCat, setShowNewCat] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<CatRow | null>(null);

  const fetchCats = async () => {
    try {
      const { data, error: err } = await supabase
        .from("categories")
        .select("id, name, sort_order, subcategories(id, name, sort_order)")
        .order("sort_order");
      if (err) setLoadError(err.message);
      else if (data) { setCats(data as CatRow[]); setLoadError(""); }
    } catch {
      setLoadError(SIN_RESPUESTA);
    } finally {
      setLoading(false);
    }
    refreshCatalog();
  };

  useEffect(() => {
    const t = setTimeout(() => { setLoading(false); setLoadError(SIN_RESPUESTA); }, 10000);
    fetchCats().finally(() => clearTimeout(t));
    return () => clearTimeout(t);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  const saveCatName = async (cat: CatRow) => {
    await supabase.from("categories").update({ name: cat.name }).eq("id", cat.id);
    setEditing(null);
    refreshCatalog();
  };

  const addCategory = async () => {
    const name = newCatName.trim().toUpperCase();
    if (!name) return;
    const id = slugify(name);
    if (!id) { setError("Ese nombre no genera un identificador válido."); return; }

    setAddingCat(true); setError("");
    const maxOrder = Math.max(0, ...cats.map((c) => c.sort_order ?? 0));
    const { error: err } = await supabase
      .from("categories")
      .insert({ id, name, sort_order: maxOrder + 1 });

    if (err) {
      setError(err.code === "23505" ? "Ya existe una categoría con ese nombre." : err.message);
    } else {
      setNewCatName(""); setShowNewCat(false); fetchCats();
    }
    setAddingCat(false);
  };

  const deleteCategory = async (id: string) => {
    await supabase.from("categories").delete().eq("id", id);
    setConfirmDelete(null); fetchCats();
  };

  const addSub = async (catId: string) => {
    const name = (newSub[catId] ?? "").trim();
    if (!name) return;
    const { error: err } = await supabase
      .from("subcategories")
      .insert({ category_id: catId, name, sort_order: 99 });
    if (!err) { setNewSub((prev) => ({ ...prev, [catId]: "" })); fetchCats(); }
  };

  const removeSub = async (subId: string) => {
    await supabase.from("subcategories").delete().eq("id", subId);
    fetchCats();
  };

  const totalSubs = cats.reduce((a, c) => a + (c.subcategories?.length ?? 0), 0);

  return (
    <Page>
      <PageHead
        title="Categorías"
        sub="Cómo se ordena el catálogo en el buscador y en el menú lateral de la tienda."
        action={
          <Btn
            variant={showNewCat ? "ghost" : "acento"}
            size="md"
            onClick={() => { setShowNewCat(!showNewCat); setError(""); }}
          >
            {showNewCat ? "Cancelar" : "+ Nueva categoría"}
          </Btn>
        }
      />

      <StatRow cols={3}>
        <Stat label="Categorías"    value={cats.length} />
        <Stat label="Subcategorías" value={totalSubs} tone="acento" />
        <Stat label="Promedio por categoría" value={cats.length ? (totalSubs / cats.length).toFixed(1) : "—"} />
      </StatRow>

      {showNewCat && (
        <Panel title="Nueva categoría" className="mb-8">
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-[260px] flex-1">
              <Input
                autoFocus
                placeholder="Ej: EMBRAGUE"
                value={newCatName}
                onChange={(e) => { setNewCatName(e.target.value.toUpperCase()); setError(""); }}
                onKeyDown={(e) => { if (e.key === "Enter") addCategory(); }}
              />
              {newCatName && (
                <p className="ag-label mt-2 normal-case tracking-[0.08em]">
                  Identificador: <span className="ag-mono text-acentohi">{slugify(newCatName)}</span>
                </p>
              )}
              {error && <div className="mt-2"><Msg tone="sale">{error}</Msg></div>}
            </div>
            <Btn variant="acento" size="md" onClick={addCategory} disabled={addingCat || !newCatName.trim()}>
              {addingCat ? "Creando…" : "Crear categoría"}
            </Btn>
          </div>
        </Panel>
      )}

      {loading ? (
        <div className="border border-line bg-panel"><Loading label="Cargando categorías" /></div>
      ) : loadError && cats.length === 0 ? (
        <div className="border border-line bg-panel"><ErrorState msg={loadError} /></div>
      ) : cats.length === 0 ? (
        <div className="border border-line bg-panel">
          <Empty
            title="No hay categorías cargadas"
            sub="Corré supabase/parches/indumentaria.sql para cargar las 11 categorías con sus subcategorías."
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {cats.map((cat) => (
            <section key={cat.id} className="border border-line bg-panel">

              <div className="flex items-center gap-3 border-b border-line px-6 py-5">
                <span className="h-6 w-[3px] shrink-0 bg-acento" aria-hidden="true" />
                {editing === cat.id ? (
                  <input
                    autoFocus
                    value={cat.name}
                    onChange={(e) =>
                      setCats((cs) => cs.map((c) => c.id === cat.id ? { ...c, name: e.target.value.toUpperCase() } : c))
                    }
                    onBlur={() => saveCatName(cat)}
                    onKeyDown={(e) => { if (e.key === "Enter") saveCatName(cat); }}
                    className="flex-1 border border-acento bg-ink px-3 py-2 font-display text-base font-extrabold uppercase text-chalk focus:outline-none"
                  />
                ) : (
                  <button
                    onClick={() => setEditing(cat.id)}
                    title="Click para renombrar"
                    className="flex-1 truncate text-left font-display text-base font-extrabold uppercase transition-colors hover:text-acentohi"
                  >
                    {cat.name}
                  </button>
                )}
                <Badge>{cat.subcategories?.length ?? 0} subs</Badge>
                <button
                  onClick={() => setConfirmDelete(cat)}
                  title="Eliminar categoría"
                  className="px-1 text-dim transition-colors hover:text-sale"
                >
                  ✕
                </button>
              </div>

              <div className="p-6">
                <div className="mb-4 space-y-px">
                  {(cat.subcategories ?? []).map((sub) => (
                    <div
                      key={sub.id}
                      className="group flex items-center justify-between gap-3 border border-line bg-ink px-4 py-2.5"
                    >
                      <span className="truncate text-sm font-light text-mute">{sub.name}</span>
                      <button
                        onClick={() => removeSub(sub.id)}
                        className="ag-label shrink-0 opacity-0 transition-opacity hover:text-sale group-hover:opacity-100"
                      >
                        Quitar
                      </button>
                    </div>
                  ))}
                  {(cat.subcategories ?? []).length === 0 && (
                    <p className="ag-label">Sin subcategorías</p>
                  )}
                </div>

                <div className="flex gap-2">
                  <Input
                    placeholder="Nueva subcategoría…"
                    value={newSub[cat.id] ?? ""}
                    onChange={(e) => setNewSub((prev) => ({ ...prev, [cat.id]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === "Enter") addSub(cat.id); }}
                    className="flex-1"
                  />
                  <Btn size="sm" onClick={() => addSub(cat.id)}>Agregar</Btn>
                </div>
              </div>
            </section>
          ))}
        </div>
      )}

      <Note>Click en el nombre de una categoría para renombrarla · Enter guarda</Note>

      <Confirm
        open={confirmDelete !== null}
        title="¿Eliminar la categoría?"
        body={`Se borra «${confirmDelete?.name ?? ""}» con sus ${confirmDelete?.subcategories?.length ?? 0} subcategorías. Los productos que la tenían quedan sin categoría y hay que reasignarlos a mano.`}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && deleteCategory(confirmDelete.id)}
      />
    </Page>
  );
}

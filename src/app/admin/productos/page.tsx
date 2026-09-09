"use client";

import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { useProducts } from "@/context/ProductsContext";
import { useCatalogCategories } from "@/context/CatalogCategoriesContext";
import { supabase, supabaseConfigurado } from "@/lib/supabase";
import { claveDeArchivo, traducirErrorDeSubida } from "@/lib/subir-fotos";
import { Product, variantKey } from "@/types";
import { ESCALAS_DE_TALLE, COLORES } from "@/data/categories";
import {
  Page, PageHead, StatRow, Stat, Btn, Field, Input, TextArea, Select, Check,
  Badge, TableWrap, THead, Td, Row, Empty, Loading, Modal, Confirm, Note, Msg,
  fmtARS, fmtARS2,
} from "@/components/admin/ui";

const EMPTY_FORM: Omit<Product, "id"> = {
  title:       "",
  price:       0,
  price_before: 0,
  cost_price:  0,
  icon:        "👕",
  categoryId:  "mujer",
  sizes:       [],
  colors:      [],
  stock_variantes: {},
  material:    "",
  composicion: "",
  cuidados:    "",
  subcategory: "",
  brand:       "",
  sku:         "",
  description: "",
  stock:       0,
  image:       "",
  images:      [],
  isNew:       false,
  isExclusive: false,
  isOutlet:    false,
};

export default function ProductosPage() {
  const { products, loading, addProduct, updateProduct, deleteProduct } = useProducts();
  const { categories } = useCatalogCategories();

  const [editingId,     setEditingId]     = useState<string | null>(null);
  const [isNew,         setIsNew]         = useState(false);
  const [form,          setForm]          = useState<Omit<Product, "id">>(EMPTY_FORM);
  const [deleteTarget,  setDeleteTarget]  = useState<Product | null>(null);
  const [uploading,     setUploading]     = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [saveError,     setSaveError]     = useState("");
  const [costs,         setCosts]         = useState<Record<string, number>>({});
  const [search,        setSearch]        = useState("");
  const [filterCat,     setFilterCat]     = useState("all");
  const [onlyNoStock,   setOnlyNoStock]   = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const formOpen = isNew || editingId !== null;

  /* El fetch público del catálogo excluye cost_price (es interno), así que
     el panel lo trae aparte para no pisarlo con ceros al editar. */
  const fetchCosts = useCallback(async () => {
    if (!supabaseConfigurado) return;
    const { data } = await supabase.from("products").select("id, cost_price");
    if (data) {
      setCosts(Object.fromEntries(
        data.map((r) => [r.id as string, Number(r.cost_price) || 0])
      ));
    }
  }, []);

  useEffect(() => { fetchCosts(); }, [fetchCosts]);

  const costOf = (p: Product) => costs[p.id] ?? p.cost_price ?? 0;

  const allFormImages: string[] = [
    ...(form.image ? [form.image] : []),
    ...(form.images ?? []),
  ];

  const subcategoryOptions =
    categories.find((c) => c.id === form.categoryId)?.subCategories ?? [];

  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? id;

  /* ── Filtros ─────────────────────────────────────────────────── */
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (filterCat !== "all" && p.categoryId !== filterCat) return false;
      if (onlyNoStock && (p.stock ?? 0) > 0) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        (p.brand ?? "").toLowerCase().includes(q) ||
        (p.sku ?? "").toLowerCase().includes(q) ||
        (p.subcategory ?? "").toLowerCase().includes(q)
      );
    });
  }, [products, search, filterCat, onlyNoStock]);

  const inventoryValue = products.reduce((a, p) => a + p.price * (p.stock ?? 0), 0);

  /* ── Formulario ──────────────────────────────────────────────── */
  const openNew = () => {
    setForm({ ...EMPTY_FORM, categoryId: categories[0]?.id ?? "mujer" });
    setEditingId(null); setIsNew(true); setSaveError("");
  };

  const openEdit = (p: Product) => {
    setForm({
      title:       p.title,
      price:       p.price,
      cost_price:  costOf(p),
      icon:        p.icon,
      categoryId:  p.categoryId,
      subcategory: p.subcategory ?? "",
      brand:       p.brand       ?? "",
      sku:         p.sku         ?? "",
      description: p.description ?? "",
      stock:       p.stock       ?? 0,
      image:       p.image       ?? "",
      images:      p.images      ?? [],
      isNew:       p.isNew       ?? false,
      isExclusive: p.isExclusive ?? false,
      isOutlet:    p.isOutlet    ?? false,
    });
    setEditingId(p.id); setIsNew(false); setSaveError("");
  };

  const closeForm = () => { setEditingId(null); setIsNew(false); };

  const save = async () => {
    if (!form.title.trim()) { setSaveError("El nombre del producto es obligatorio."); return; }
    setSaveError(""); setSaving(true);
    try {
      if (isNew)          await addProduct(form);
      else if (editingId) await updateProduct({ ...form, id: editingId });
      await fetchCosts();
      closeForm();
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Error al guardar.");
    } finally {
      setSaving(false);
    }
  };

  const handleCategoryChange = (catId: string) =>
    setForm((f) => ({ ...f, categoryId: catId, subcategory: "" }));

  /* ── Imágenes ────────────────────────────────────────────────── */
  const handleImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true); setSaveError("");

    const uploaded: string[] = [];
    const fallaron: string[] = [];

    for (const file of files) {
      // claveDeArchivo() en vez de pegarle la extensión cruda al nombre: el
      // nombre que trae la foto del celular puede tener espacios, mayúsculas
      // o directamente no tener punto, y ahí Supabase rechaza la clave.
      // Ver el comentario de arriba de src/lib/subir-fotos.ts.
      const fileName = claveDeArchivo(file);

      const { data, error } = await supabase.storage
        .from("products")
        .upload(fileName, file, { cacheControl: "3600", upsert: false });

      if (error || !data) {
        const msg = error?.message ?? "sin detalle";
        console.error("[admin/productos] no se pudo subir la foto:", file.name, error);
        fallaron.push(`${file.name}: ${traducirErrorDeSubida(msg, file)}`);
        continue;
      }

      const { data: { publicUrl } } = supabase.storage.from("products").getPublicUrl(data.path);
      uploaded.push(publicUrl);
    }

    if (fallaron.length) setSaveError(fallaron.join(" · "));

    if (!uploaded.length) { setUploading(false); return; }

    setForm((f) => f.image
      ? { ...f, images: [...(f.images ?? []), ...uploaded] }
      : { ...f, image: uploaded[0], images: [...(f.images ?? []), ...uploaded.slice(1)] }
    );

    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeImage = (url: string) => {
    setForm((f) => {
      if (f.image === url) {
        const [next, ...rest] = f.images ?? [];
        return { ...f, image: next ?? "", images: rest };
      }
      return { ...f, images: (f.images ?? []).filter((u) => u !== url) };
    });
  };

  const setPrimary = (url: string) => {
    setForm((f) => {
      const oldPrimary  = f.image;
      const otherImages = (f.images ?? []).filter((u) => u !== url);
      return { ...f, image: url, images: oldPrimary ? [oldPrimary, ...otherImages] : otherImages };
    });
  };

  const margen = (form.cost_price ?? 0) > 0 && form.price > 0
    ? ((form.price - (form.cost_price ?? 0)) / form.price) * 100
    : null;

  return (
    <Page>
      <PageHead
        title="Productos"
        sub="El catálogo que ve la tienda. Los cambios se publican al instante."
        action={<Btn variant="acento" size="md" onClick={openNew}>+ Nuevo producto</Btn>}
      />

      <StatRow>
        <Stat label="En catálogo"        value={products.length} />
        <Stat label="Con stock"          value={products.filter((p) => (p.stock ?? 0) > 0).length} tone="ok" />
        <Stat label="Sin stock"          value={products.filter((p) => (p.stock ?? 0) === 0).length} tone="warn" />
        <Stat label="Valor de inventario" value={fmtARS(inventoryValue)} hint="precio × stock" tone="acento" />
      </StatRow>

      {/* Filtros */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, marca, código o subcategoría…"
          className="min-w-[260px] flex-1"
        />
        <div className="w-full sm:w-56">
          <Select value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
            <option value="all">Todas las categorías</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>
        <Btn
          variant={onlyNoStock ? "acento" : "ghost"}
          size="sm"
          onClick={() => setOnlyNoStock((v) => !v)}
        >
          Sin stock
        </Btn>
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="border border-line bg-panel"><Loading label="Cargando catálogo" /></div>
      ) : visible.length === 0 ? (
        <div className="border border-line bg-panel">
          <Empty
            title={products.length === 0 ? "Todavía no hay productos" : "Ningún producto coincide"}
            sub={products.length === 0
              ? "Cargá el primero con «Nuevo producto». El catálogo de ejemplo sólo viene con una base creada de cero."
              : "Probá con otro término o limpiá los filtros."}
          />
        </div>
      ) : (
        <TableWrap>
          <THead cols={["Producto", "Categoría", "Precio", "Stock", "Etiquetas", ""]} />
          <tbody>
            {visible.map((p) => {
              const totalImgs = (p.image ? 1 : 0) + (p.images?.length ?? 0);
              const stock = p.stock ?? 0;
              return (
                <Row key={p.id}>
                  <Td>
                    <div className="flex max-w-[360px] items-center gap-3.5">
                      <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden border border-line bg-ink text-lg">
                        {p.image
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={p.image} alt="" className="h-full w-full object-cover" />
                          : <span>{p.icon}</span>}
                        {totalImgs > 1 && (
                          <span className="absolute bottom-0 right-0 bg-ink/90 px-1 font-cond text-[0.6rem] font-semibold text-mute">
                            {totalImgs}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 font-display text-[0.95rem] font-extrabold uppercase leading-tight">
                          {p.title}
                        </p>
                        <p className="ag-label mt-1 truncate normal-case tracking-[0.08em]">
                          {p.brand && <span className="text-mute">{p.brand}</span>}
                          {p.brand && p.sku && " · "}
                          {p.sku && <span className="ag-mono text-dim">{p.sku}</span>}
                          {!p.brand && !p.sku && (p.subcategory ?? "—")}
                        </p>
                      </div>
                    </div>
                  </Td>
                  <Td><Badge>{catName(p.categoryId)}</Badge></Td>
                  <Td className="whitespace-nowrap"><span className="ag-num font-display font-extrabold">{fmtARS(p.price)}</span></Td>
                  <Td className="whitespace-nowrap">
                    <span className={`ag-num font-display font-extrabold ${stock === 0 ? "text-warn" : ""}`}>
                      {stock}
                    </span>
                    <span className="ag-label ml-1">u.</span>
                  </Td>
                  <Td>
                    <div className="flex max-w-[110px] flex-wrap gap-1.5">
                      {p.isNew       && <Badge tone="acento">Nuevo</Badge>}
                      {p.isExclusive && <Badge>Excl.</Badge>}
                      {p.isOutlet    && <Badge tone="sale">Outlet</Badge>}
                    </div>
                  </Td>
                  <Td className="whitespace-nowrap text-right">
                    <div className="flex justify-end gap-2">
                      <Btn size="xs" onClick={() => openEdit(p)}>Editar</Btn>
                      <Btn size="xs" variant="danger" onClick={() => setDeleteTarget(p)}>Borrar</Btn>
                    </div>
                  </Td>
                </Row>
              );
            })}
          </tbody>
        </TableWrap>
      )}

      <Note>
        {visible.length} de {products.length} productos · las fotos se guardan en Supabase Storage
      </Note>

      {/* ── Formulario ───────────────────────────────────────────── */}
      <Modal
        open={formOpen}
        onClose={closeForm}
        eyebrow={isNew ? "Alta" : "Edición"}
        title={isNew ? "Nuevo producto" : form.title || "Editar producto"}
        width="max-w-4xl"
        footer={
          <>
            <Btn variant="acento" size="md" onClick={save} disabled={saving || uploading}>
              {saving ? "Guardando…" : isNew ? "Crear producto" : "Guardar cambios"}
            </Btn>
            <Btn size="md" onClick={closeForm}>Cancelar</Btn>
            {saveError && <Msg tone="sale">{saveError}</Msg>}
          </>
        }
      >
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">

          <Field label="Nombre del producto *" span>
            <Input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Ej: Remera oversize de algodón peinado"
            />
          </Field>

          <Field label="Marca" hint="Levi's, Nike, Vans, Cheeky…">
            <Input
              value={form.brand ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
              placeholder="Levi's"
            />
          </Field>

          <Field label="Código / SKU" hint="El código con el que lo busca el cliente">
            <Input
              value={form.sku ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
              placeholder="RM-OVS-24"
              className="ag-mono"
            />
          </Field>

          <Field label="Precio de venta (ARS)">
            <Input
              type="number" min={0} step={0.01} value={form.price}
              onChange={(e) => setForm((f) => ({ ...f, price: parseFloat(e.target.value) || 0 }))}
            />
          </Field>

          <Field label="Precio anterior (ARS)" hint="Se muestra tachado al lado del precio. Dejalo en 0 si no es oferta.">
            <Input
              type="number" min={0} step={0.01} value={form.price_before ?? 0}
              onChange={(e) => setForm((f) => ({ ...f, price_before: parseFloat(e.target.value) || 0 }))}
            />
          </Field>

          <Field label="Stock total (unidades)"
                 hint="Es el que decide si se puede comprar. Si cargás el detalle por talle, poné acá la suma.">
            <Input
              type="number" min={0} value={form.stock}
              onChange={(e) => setForm((f) => ({ ...f, stock: parseInt(e.target.value) || 0 }))}
            />
          </Field>

          <Field label="Categoría">
            <Select value={form.categoryId} onChange={(e) => handleCategoryChange(e.target.value)}>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>

          <Field label="Subcategoría">
            <Select
              value={form.subcategory ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, subcategory: e.target.value }))}
            >
              <option value="">— Sin subcategoría —</option>
              {subcategoryOptions.map((sub) => <option key={sub} value={sub}>{sub}</option>)}
            </Select>
          </Field>

          <Field label="Ícono" hint="Se usa cuando el producto no tiene foto">
            <Input
              value={form.icon} maxLength={4}
              onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
              className="text-center text-xl"
            />
          </Field>

          <div className="flex items-end gap-6 pb-2">
            <Check label="Nuevo"     checked={!!form.isNew}       onChange={(v) => setForm((f) => ({ ...f, isNew: v }))} />
            <Check label="Selección" checked={!!form.isExclusive} onChange={(v) => setForm((f) => ({ ...f, isExclusive: v }))} />
            <Check label="Outlet"    checked={!!form.isOutlet}    onChange={(v) => setForm((f) => ({ ...f, isOutlet: v }))} />
          </div>


          {/* ── Talles, colores y stock por variante ──────────────────────
              Esto es lo propio del rubro y lo que más cuesta cargar bien, así
              que está armado para que sea rápido: los talles salen de una
              escala con un click y los colores de una paleta fija (para que
              "Negro" se escriba siempre igual y el filtro de la tienda
              funcione). El detalle de stock por talle y color es opcional: sin
              él la tienda usa el stock total y no tacha ningún talle. */}
          <div className="sm:col-span-2 border border-line bg-panel p-5">
            <p className="ag-eyebrow mb-4">Talles y colores</p>

            <Field label="Escalas de talle" hint="Un click carga la escala entera. Después podés sacar los que no tengas.">
              <div className="flex flex-wrap gap-2">
                {Object.entries(ESCALAS_DE_TALLE).map(([nombre, escala]) => (
                  <Btn key={nombre} size="xs" onClick={() => setForm((f) => ({ ...f, sizes: [...escala] }))}>
                    {nombre}
                  </Btn>
                ))}
                {(form.sizes?.length ?? 0) > 0 && (
                  <Btn size="xs" onClick={() => setForm((f) => ({ ...f, sizes: [], stock_variantes: {} }))}>
                    Vaciar
                  </Btn>
                )}
              </div>
            </Field>

            <div className="mt-4">
              <Field label="Talles publicados" hint="Separados por coma. Se muestran en este orden.">
                <Input
                  value={(form.sizes ?? []).join(", ")}
                  onChange={(e) => setForm((f) => ({
                    ...f,
                    sizes: e.target.value.split(",").map((t) => t.trim()).filter(Boolean),
                  }))}
                  placeholder="S, M, L, XL"
                />
              </Field>
            </div>

            <div className="mt-5">
              <label className="ag-label mb-2 block">Colores</label>
              <div className="flex flex-wrap gap-2">
                {COLORES.map((c) => {
                  const puesto = (form.colors ?? []).some((x) => x.name === c.name);
                  return (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => setForm((f) => ({
                        ...f,
                        colors: puesto
                          ? (f.colors ?? []).filter((x) => x.name !== c.name)
                          : [...(f.colors ?? []), { name: c.name, hex: c.hex }],
                      }))}
                      className={`flex items-center gap-2 border px-2.5 py-1.5 text-[0.82rem] transition-colors ${
                        puesto ? "border-chalk bg-chalk text-white" : "border-line text-mute hover:border-chalk"
                      }`}
                    >
                      <span className="h-4 w-4 rounded-full border border-black/20" style={{ background: c.hex }} />
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {(form.sizes?.length ?? 0) > 0 && (form.colors?.length ?? 0) > 0 && (
              <div className="mt-6">
                <label className="ag-label mb-2 block">Stock por talle y color (opcional)</label>
                <div className="overflow-x-auto border border-line bg-ink">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="border-b border-line">
                        <th className="px-3 py-2 text-[0.75rem] uppercase tracking-[0.14em] text-mute">Color</th>
                        {(form.sizes ?? []).map((t) => (
                          <th key={t} className="px-2 py-2 text-center text-[0.75rem] uppercase tracking-[0.14em] text-mute">{t}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(form.colors ?? []).map((c) => (
                        <tr key={c.name} className="border-b border-line last:border-0">
                          <td className="whitespace-nowrap px-3 py-2 text-[0.85rem]">
                            <span className="mr-2 inline-block h-3 w-3 rounded-full border border-black/20 align-middle" style={{ background: c.hex }} />
                            {c.name}
                          </td>
                          {(form.sizes ?? []).map((t) => {
                            const k = variantKey(t, c.name);
                            return (
                              <td key={k} className="px-1 py-1">
                                <input
                                  type="number" min={0}
                                  value={form.stock_variantes?.[k] ?? 0}
                                  onChange={(e) => setForm((f) => ({
                                    ...f,
                                    stock_variantes: {
                                      ...(f.stock_variantes ?? {}),
                                      [k]: parseInt(e.target.value) || 0,
                                    },
                                  }))}
                                  className="ag-input ag-num !w-[62px] !px-2 !py-1.5 text-center text-[0.85rem]"
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-[0.8rem] text-dim">
                  Un talle en 0 se muestra tachado en la ficha: el cliente ve que existe pero que no está.
                </p>
              </div>
            )}
          </div>

          <Field label="Material" hint="Lo que se lee de un vistazo en la ficha.">
            <Input
              value={form.material ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, material: e.target.value }))}
              placeholder="Algodón 100%"
            />
          </Field>

          <Field label="Cuidados" hint="Cómo se lava y se plancha.">
            <Input
              value={form.cuidados ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, cuidados: e.target.value }))}
              placeholder="Lavar a máquina con agua fría. No usar secarropas."
            />
          </Field>

          <Field label="Composición (etiqueta completa)" span>
            <Input
              value={form.composicion ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, composicion: e.target.value }))}
              placeholder="100% algodón peinado 180 g/m²"
            />
          </Field>

          <Field label="Descripción" span
                 hint="Qué es, cómo calza y para qué sirve. Dos o tres líneas.">
            <TextArea
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Algodón peinado 24/1, corte holgado y hombro caído. Cae sin marcar."
            />
          </Field>

          {/* Fotos */}
          <div className="sm:col-span-2">
            <div className="mb-3 flex items-center justify-between">
              <label className="ag-label">Fotos ({allFormImages.length})</label>
              <Btn size="xs" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? "Subiendo…" : "+ Agregar fotos"}
              </Btn>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImages} />
            </div>

            {allFormImages.length > 0 ? (
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {allFormImages.map((url, idx) => {
                  const isPrimary = url === form.image;
                  return (
                    <div key={url} className="group relative aspect-square">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url} alt={`Foto ${idx + 1}`}
                        className={`h-full w-full border object-cover ${isPrimary ? "border-acento" : "border-line"}`}
                      />
                      {isPrimary && (
                        <span className="absolute left-0 top-0 bg-acento px-1.5 py-0.5 font-cond text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-white">
                          Principal
                        </span>
                      )}
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/70 opacity-0 transition-opacity group-hover:opacity-100">
                        {!isPrimary && (
                          <button
                            type="button" onClick={() => setPrimary(url)}
                            className="w-[80%] bg-acento py-1 font-cond text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-white"
                          >
                            Principal
                          </button>
                        )}
                        <button
                          type="button" onClick={() => removeImage(url)}
                          className="w-[80%] bg-sale py-1 font-cond text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-white"
                        >
                          Quitar
                        </button>
                      </div>
                    </div>
                  );
                })}
                <button
                  type="button" onClick={() => fileRef.current?.click()}
                  className="flex aspect-square flex-col items-center justify-center border border-dashed border-line text-dim transition-colors hover:border-acento hover:text-mute"
                >
                  <span className="text-xl leading-none">+</span>
                  <span className="ag-label mt-1">Foto</span>
                </button>
              </div>
            ) : (
              <button
                type="button" onClick={() => fileRef.current?.click()}
                className="w-full border border-dashed border-line px-6 py-9 text-center transition-colors hover:border-acento"
              >
                <p className="ag-label">{uploading ? "Subiendo…" : "Click para subir fotos"}</p>
                <p className="mt-1.5 text-sm font-light text-dim">
                  Podés seleccionar varias a la vez · JPG, PNG, WEBP
                </p>
              </button>
            )}
            <p className="ag-label mt-2.5 normal-case tracking-[0.08em]">
              La foto principal es la de la tarjeta; el resto va a la galería de la ficha.
            </p>
          </div>

          {/* Interno */}
          <div className="border border-warn/30 bg-warn/5 p-5 sm:col-span-2">
            <p className="ag-eyebrow mb-4 text-warn">Interno — no se muestra en la tienda</p>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field label="Precio de costo (ARS)">
                <Input
                  type="number" min={0} step={0.01} value={form.cost_price ?? 0}
                  onChange={(e) => setForm((f) => ({ ...f, cost_price: parseFloat(e.target.value) || 0 }))}
                />
              </Field>
              <div className="flex items-end pb-1">
                {margen !== null ? (
                  <div className="w-full border border-line bg-ink px-4 py-3">
                    <p className="ag-label">Margen estimado</p>
                    <p className="ag-num mt-1 font-display text-2xl font-extrabold text-warn">
                      {margen.toFixed(1)}%
                    </p>
                    <p className="ag-label mt-1 normal-case tracking-[0.08em]">
                      Ganancia por unidad: {fmtARS2(form.price - (form.cost_price ?? 0))}
                    </p>
                  </div>
                ) : (
                  <p className="ag-label normal-case tracking-[0.08em]">
                    Cargá el costo para ver el margen y alimentar Finanzas.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </Modal>

      <Confirm
        open={deleteTarget !== null}
        title="¿Borrar el producto?"
        body={`«${deleteTarget?.title ?? ""}» va a desaparecer del catálogo. Los pedidos que ya lo incluyen conservan su copia del nombre y el precio.`}
        confirmLabel="Sí, borrar"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteProduct(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
    </Page>
  );
}

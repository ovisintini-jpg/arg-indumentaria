"use client";

/* ── Piezas a pedido ────────────────────────────────────────────────────────
   Un producto que existe en la base y se puede pagar, pero NO sale en el
   catálogo: se llega sólo por un link secreto que le mandás al cliente que
   pidió esa pieza. Cierra el circuito del cotizador, que hasta ahora cotizaba
   pero no podía cobrar.

   Necesita supabase/parches/pedidos-especiales.sql corrido.
   ────────────────────────────────────────────────────────────────────────── */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { supabase, supabaseConfigurado, productFromDB, piezaToDB } from "@/lib/supabase";
import { claveDeArchivo, traducirErrorDeSubida } from "@/lib/subir-fotos";
import { useCatalogCategories } from "@/context/CatalogCategoriesContext";
import { Product, Consulta } from "@/types";
import {
  Page, PageHead, StatRow, Stat, Btn, Field, Input, TextArea, Select,
  Badge, TableWrap, THead, Td, Row, Empty, Loading, Modal, Confirm, Msg,
  fmtARS, fmtARS2, fmtDate, Tone,
} from "@/components/admin/ui";

type FormPieza = Omit<Product, "id">;

const EMPTY: FormPieza = {
  title: "", price: 0, cost_price: 0, envio_costo: 0,
  icon: "👕", categoryId: "mujer", subcategory: "",
  brand: "", sku: "", description: "", detalle: "",
  stock: 1, image: "", images: [],
  isNew: false, isExclusive: false, isOutlet: false,
  visibilidad: "privado",
  cliente_nombre: "", cliente_email: "", vence_el: undefined, consulta_id: undefined,
};

const PLAZOS: { label: string; dias: number | null }[] = [
  { label: "7 días",   dias: 7 },
  { label: "15 días",  dias: 15 },
  { label: "30 días",  dias: 30 },
  { label: "No vence", dias: null },
];

const enDias = (dias: number | null) =>
  dias === null ? undefined : new Date(Date.now() + dias * 86_400_000).toISOString();

const vencida = (p: Product) => !!p.vence_el && new Date(p.vence_el) < new Date();


export default function APedidoPage() {
  const { categories } = useCatalogCategories();

  const [piezas,    setPiezas]    = useState<Product[]>([]);
  const [pagadas,   setPagadas]   = useState<Record<string, string>>({});
  const [consultas, setConsultas] = useState<Consulta[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [sinParche, setSinParche] = useState(false);

  const [abierto,   setAbierto]   = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form,      setForm]      = useState<FormPieza>(EMPTY);
  const [saving,    setSaving]    = useState(false);
  const [saveError, setSaveError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [borrar,    setBorrar]    = useState<Product | null>(null);
  const [copiado,   setCopiado]   = useState<string | null>(null);
  const [origin,    setOrigin]    = useState("");
  const [busca,     setBusca]     = useState("");
  // Cuál de los cuatro botones de plazo está resaltado. undefined = ninguno
  // (una pieza que estás editando ya tiene su fecha puesta).
  const [plazoSel,  setPlazoSel]  = useState<number | null | undefined>(15);

  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => setOrigin(window.location.origin), []);

  const linkDe = (p: Product) => `${origin}/pedido-especial/${p.token ?? ""}`;

  /* ── Datos ──────────────────────────────────────────────────── */
  const fetchPiezas = useCallback(async () => {
    if (!supabaseConfigurado) { setLoading(false); return; }

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("visibilidad", "privado")
      .order("created_at", { ascending: false });

    if (error) {
      // La columna no existe todavía: falta correr el parche.
      setSinParche(true);
      setLoading(false);
      return;
    }

    const filas = (data ?? []).map((r) => productFromDB(r as Record<string, unknown>));
    setPiezas(filas);
    setLoading(false);

    // ¿Cuáles ya se pagaron? Un item de pedido con el pedido pagado.
    if (filas.length) {
      const { data: items } = await supabase
        .from("order_items")
        .select("product_id, orders!inner(order_number, payment_status)")
        .in("product_id", filas.map((f) => f.id));

      if (items) {
        const map: Record<string, string> = {};
        for (const it of items as unknown as {
          product_id: string;
          orders: { order_number: string; payment_status: string } | null;
        }[]) {
          if (it.orders?.payment_status === "paid" && it.product_id) {
            map[it.product_id] = it.orders.order_number;
          }
        }
        setPagadas(map);
      }
    }
  }, []);

  const fetchConsultas = useCallback(async () => {
    if (!supabaseConfigurado) return;
    const { data } = await supabase
      .from("consultas")
      .select("*")
      .eq("estado", "cotizada")
      .order("created_at", { ascending: false })
      .limit(30);
    if (data) setConsultas(data as unknown as Consulta[]);
  }, []);

  useEffect(() => { fetchPiezas(); fetchConsultas(); }, [fetchPiezas, fetchConsultas]);

  /* ── Estado de cada pieza ───────────────────────────────────── */
  const estadoDe = (p: Product): { label: string; tone: Tone } => {
    if (pagadas[p.id]) return { label: `Pagada ${pagadas[p.id]}`, tone: "ok" };
    if (vencida(p))    return { label: "Vencida",                 tone: "sale" };
    return { label: "Esperando pago", tone: "acento" };
  };

  const visibles = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return piezas;
    return piezas.filter((p) =>
      p.title.toLowerCase().includes(q) ||
      (p.cliente_nombre ?? "").toLowerCase().includes(q) ||
      (p.cliente_email  ?? "").toLowerCase().includes(q) ||
      (p.sku            ?? "").toLowerCase().includes(q)
    );
  }, [piezas, busca]);

  const nPagadas  = piezas.filter((p) => pagadas[p.id]).length;
  const nVencidas = piezas.filter((p) => !pagadas[p.id] && vencida(p)).length;
  const nActivas  = piezas.length - nPagadas - nVencidas;
  const cobrado   = piezas
    .filter((p) => pagadas[p.id])
    .reduce((a, p) => a + p.price + (p.envio_costo ?? 0), 0);

  /* ── Formulario ─────────────────────────────────────────────── */
  const abrirNueva = () => {
    setForm({ ...EMPTY, categoryId: categories[0]?.id ?? "mujer", vence_el: enDias(15) });
    setPlazoSel(15);
    setEditingId(null); setSaveError(""); setAbierto(true);
  };

  const abrirEdicion = (p: Product) => {
    setForm({ ...p });
    setPlazoSel(p.vence_el ? undefined : null);
    setEditingId(p.id); setSaveError(""); setAbierto(true);
  };

  /* Trae todo lo que el cliente ya escribió al pedirla: la prenda, el talle
     y el color, sus fotos, su contacto y el precio que le pasaste. */
  const desdeConsulta = (id: string) => {
    const c = consultas.find((x) => x.id === id);
    if (!c) return;
    const variante = [c.marca_buscada, c.talle_buscado && `talle ${c.talle_buscado}`, c.color_buscado]
      .filter(Boolean).join(", ");
    setForm((f) => ({
      ...f,
      title:          c.producto_buscado.slice(0, 120),
      sku:            c.codigo ?? "",
      description:    variante ? `${variante}.${c.referencia ? ` Referencia: ${c.referencia}` : ""}` : "",
      detalle:        c.plazo_estimado ? `Plazo estimado: ${c.plazo_estimado}.` : "",
      price:          Number(c.precio_cotizado ?? 0),
      image:          c.fotos?.[0] ?? "",
      images:         c.fotos?.slice(1) ?? [],
      cliente_nombre: c.nombre,
      cliente_email:  c.email,
      consulta_id:    c.id,
    }));
  };

  const guardar = async () => {
    if (!form.title.trim()) { setSaveError("Ponele un nombre a la pieza."); return; }
    if (form.price <= 0)    { setSaveError("El precio al cliente tiene que ser mayor a cero."); return; }

    setSaveError(""); setSaving(true);
    try {
      const payload = piezaToDB(form);

      if (editingId) {
        const { error } = await supabase.from("products").update(payload).eq("id", editingId);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw new Error(error.message);
      }

      await fetchPiezas();
      setAbierto(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "No se pudo guardar.";
      setSaveError(
        /policy|42501/i.test(msg)
          ? "Sin permisos. Verificá que tu usuario esté como admin en Supabase."
          : msg
      );
    } finally {
      setSaving(false);
    }
  };

  const eliminar = async (p: Product) => {
    await supabase.from("products").delete().eq("id", p.id);
    setBorrar(null);
    fetchPiezas();
  };

  /* ── Fotos ───────────────────────────────────────────────────
     Mismo bucket ("products") y mismo flujo que Productos. La diferencia
     está en el manejo del error: acá el motivo real de Supabase llega a la
     pantalla en vez de morir en un "no se pudo" que no dice nada. */
  const subirFotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true); setSaveError("");

    const urls: string[] = [];
    const fallaron: string[] = [];

    for (const file of files) {
      const nombre = claveDeArchivo(file);

      const { data, error } = await supabase.storage
        .from("products").upload(nombre, file, { cacheControl: "3600", upsert: false });

      if (error || !data) {
        const msg = error?.message ?? "sin detalle";
        console.error("[a-pedido] no se pudo subir la foto:", file.name, error);
        fallaron.push(`${file.name}: ${traducirErrorDeSubida(msg, file)}`);
        continue;
      }

      urls.push(supabase.storage.from("products").getPublicUrl(data.path).data.publicUrl);
    }

    if (urls.length) {
      setForm((f) => f.image
        ? { ...f, images: [...(f.images ?? []), ...urls] }
        : { ...f, image: urls[0], images: [...(f.images ?? []), ...urls.slice(1)] });
    }

    if (fallaron.length) setSaveError(fallaron.join(" · "));

    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const quitarFoto = (url: string) =>
    setForm((f) => f.image === url
      ? { ...f, image: (f.images ?? [])[0] ?? "", images: (f.images ?? []).slice(1) }
      : { ...f, images: (f.images ?? []).filter((u) => u !== url) });

  const fotos = [...(form.image ? [form.image] : []), ...(form.images ?? [])];

  const copiar = async (p: Product) => {
    try {
      await navigator.clipboard.writeText(linkDe(p));
      setCopiado(p.id);
      setTimeout(() => setCopiado(null), 2000);
    } catch { /* el navegador lo bloqueó: queda el link a la vista igual */ }
  };

  const whatsapp = (p: Product) => {
    const texto =
      `Hola${p.cliente_nombre ? ` ${p.cliente_nombre}` : ""}! Te paso la cotización de ` +
      `${p.title}: ${fmtARS(p.price)} + ${fmtARS(p.envio_costo ?? 0)} de envío. ` +
      `Podés verla y pagarla acá: ${linkDe(p)}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank");
  };

  const total   = form.price + (form.envio_costo ?? 0);
  const margen  = (form.cost_price ?? 0) > 0 && form.price > 0
    ? ((form.price - (form.cost_price ?? 0)) / form.price) * 100 : null;
  const subcategorias = categories.find((c) => c.id === form.categoryId)?.subCategories ?? [];

  /* ── Pantalla ───────────────────────────────────────────────── */
  if (loading) return <Page><Loading label="Cargando piezas a pedido" /></Page>;

  return (
    <Page>
      <PageHead
        title="A pedido"
        sub="Piezas que no van al catálogo: las creás para un cliente puntual y se las mandás por link. El envío se cobra aparte del precio."
        action={<Btn variant="acento" size="md" onClick={abrirNueva}>+ Nueva pieza a pedido</Btn>}
      />

      {sinParche && (
        <div className="mb-8">
          <Msg tone="warn">
            Falta correr <span className="ag-mono">supabase/parches/pedidos-especiales.sql</span> en
            el SQL Editor de Supabase. Hasta entonces esta pantalla no puede guardar nada.
          </Msg>
        </div>
      )}

      <StatRow>
        <Stat label="Esperando pago" value={nActivas}  tone={nActivas > 0 ? "acento" : "mute"} />
        <Stat label="Pagadas"        value={nPagadas}  tone="ok" hint={cobrado > 0 ? fmtARS(cobrado) : undefined} />
        <Stat label="Vencidas"       value={nVencidas} tone={nVencidas > 0 ? "warn" : "mute"} />
        <Stat label="Total creadas"  value={piezas.length} />
      </StatRow>

      {piezas.length > 0 && (
        <div className="mb-6 max-w-md">
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por pieza, cliente u SKU…"
          />
        </div>
      )}

      {visibles.length === 0 ? (
        <Empty
          title={piezas.length === 0 ? "Todavía no hay piezas a pedido" : "Sin resultados"}
          sub={piezas.length === 0
            ? "Cuando cotices una consulta, creá acá la pieza y mandale el link al cliente para que la pague."
            : "Probá con otro texto."}
        />
      ) : (
        <TableWrap>
          <THead cols={["Pieza", "Cliente", "Precio", "Estado", "Vence", ""]} />
          <tbody>
            {visibles.map((p) => {
              const est = estadoDe(p);
              return (
                <Row key={p.id} dim={!!pagadas[p.id]}>
                  <Td>
                    <p className="font-semibold text-chalk">{p.title}</p>
                    <p className="ag-label mt-1">
                      {[p.brand, p.sku].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </Td>
                  <Td>
                    <p className="text-chalk">{p.cliente_nombre || "—"}</p>
                    <p className="ag-label mt-1 normal-case tracking-[0.06em]">
                      {p.cliente_email || ""}
                    </p>
                  </Td>
                  <Td>
                    <p className="ag-num font-semibold text-chalk">{fmtARS(p.price)}</p>
                    <p className="ag-label mt-1">
                      {(p.envio_costo ?? 0) > 0 ? `+ ${fmtARS(p.envio_costo ?? 0)} envío` : "sin envío"}
                    </p>
                  </Td>
                  <Td><Badge tone={est.tone}>{est.label}</Badge></Td>
                  <Td>
                    <span className="ag-label">
                      {p.vence_el ? fmtDate(p.vence_el) : "no vence"}
                    </span>
                  </Td>
                  <Td className="text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Btn size="xs" onClick={() => copiar(p)}>
                        {copiado === p.id ? "✓ Copiado" : "Copiar link"}
                      </Btn>
                      <Btn size="xs" onClick={() => whatsapp(p)}>WhatsApp</Btn>
                      <Btn size="xs" onClick={() => abrirEdicion(p)}>Editar</Btn>
                      <Btn size="xs" variant="danger" onClick={() => setBorrar(p)}>Borrar</Btn>
                    </div>
                  </Td>
                </Row>
              );
            })}
          </tbody>
        </TableWrap>
      )}

      {/* ── Formulario ─────────────────────────────────────────── */}
      <Modal
        open={abierto}
        onClose={() => setAbierto(false)}
        eyebrow={editingId ? "Editar" : "Nueva"}
        title={editingId ? "Pieza a pedido" : "Nueva pieza a pedido"}
        sub="No se publica en el catálogo. El cliente sólo llega por el link."
        footer={
          <>
            <Btn variant="acento" size="md" onClick={guardar} disabled={saving}>
              {saving ? "Guardando…" : editingId ? "Guardar cambios" : "Crear y generar link"}
            </Btn>
            <Btn size="md" onClick={() => setAbierto(false)}>Cancelar</Btn>
            {saveError && <span className="text-[0.88rem] font-light text-sale">{saveError}</span>}
          </>
        }
      >
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">

          {consultas.length > 0 && !editingId && (
            <div className="sm:col-span-2 border border-acento/30 bg-acento/5 p-5">
              <Field
                label="Traer de una consulta"
                hint="Trae la prenda, el talle y el color, las fotos del cliente y el precio que le pasaste."
              >
                <Select defaultValue="" onChange={(e) => e.target.value && desdeConsulta(e.target.value)}>
                  <option value="">— Cargar a mano —</option>
                  {consultas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.numero} · {c.producto_buscado.slice(0, 45)} · {c.nombre}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          )}

          <Field label="Qué pieza es *" span>
            <Input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Bomba de agua BMW 320i E90"
            />
          </Field>

          <Field label="Marca">
            <Input value={form.brand ?? ""} placeholder="Bosch"
                   onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))} />
          </Field>

          <Field label="Código / SKU">
            <Input value={form.sku ?? ""} placeholder="11517586925" className="ag-mono"
                   onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} />
          </Field>

          <Field label="Categoría">
            <Select value={form.categoryId}
                    onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value, subcategory: "" }))}>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>

          <Field label="Subcategoría">
            <Select value={form.subcategory ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, subcategory: e.target.value }))}>
              <option value="">— Sin subcategoría —</option>
              {subcategorias.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>

          {/* ── Precio ────────────────────────────────────────── */}
          <div className="sm:col-span-2 border border-line bg-ink p-5">
            <p className="ag-eyebrow mb-4 text-chalk">El precio</p>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              <Field label="Costo (interno)" hint="Lo que te sale a vos">
                <Input type="number" min={0} step={0.01} value={form.cost_price ?? 0}
                       onChange={(e) => setForm((f) => ({ ...f, cost_price: parseFloat(e.target.value) || 0 }))} />
              </Field>
              <Field label="Precio al cliente *">
                <Input type="number" min={0} step={0.01} value={form.price}
                       onChange={(e) => setForm((f) => ({ ...f, price: parseFloat(e.target.value) || 0 }))} />
              </Field>
              <Field label="Costo de envío" hint="Se cobra aparte, discriminado">
                <Input type="number" min={0} step={0.01} value={form.envio_costo ?? 0}
                       onChange={(e) => setForm((f) => ({ ...f, envio_costo: parseFloat(e.target.value) || 0 }))} />
              </Field>
            </div>
            <div className="mt-5 flex flex-wrap items-baseline justify-between gap-4 border-t border-line pt-4">
              <span className="ag-eyebrow text-chalk">El cliente paga</span>
              <span className="ag-num font-display text-[1.6rem] font-extrabold tracking-[-0.035em] text-acentohi">
                {fmtARS(total)}
              </span>
            </div>
            {margen !== null && (
              <p className="ag-label mt-2 normal-case tracking-[0.08em]">
                Margen sobre la pieza: {margen.toFixed(1)}% · ganás {fmtARS2(form.price - (form.cost_price ?? 0))}
              </p>
            )}
          </div>

          {/* ── Para quién ────────────────────────────────────── */}
          <Field label="Nombre del cliente">
            <Input value={form.cliente_nombre ?? ""} placeholder="Juan Pérez"
                   onChange={(e) => setForm((f) => ({ ...f, cliente_nombre: e.target.value }))} />
          </Field>

          <Field label="Email del cliente">
            <Input type="email" value={form.cliente_email ?? ""} placeholder="juan@ejemplo.com"
                   onChange={(e) => setForm((f) => ({ ...f, cliente_email: e.target.value }))} />
          </Field>

          <div className="sm:col-span-2">
            <label className="ag-label mb-2 block">La cotización vence</label>
            <div className="flex flex-wrap gap-2">
              {PLAZOS.map((p) => (
                <Btn key={p.label} size="xs"
                     variant={plazoSel === p.dias ? "acento" : "ghost"}
                     onClick={() => {
                       setPlazoSel(p.dias);
                       setForm((f) => ({ ...f, vence_el: enDias(p.dias) }));
                     }}>
                  {p.label}
                </Btn>
              ))}
            </div>
            <p className="ag-label mt-2 normal-case tracking-[0.08em]">
              {form.vence_el
                ? `Después del ${fmtDate(form.vence_el)} el link deja de funcionar.`
                : "El link no caduca."}
            </p>
          </div>

          <Field label="Stock" hint="Cuántas unidades puede comprar">
            <Input type="number" min={1} value={form.stock ?? 1}
                   onChange={(e) => setForm((f) => ({ ...f, stock: parseInt(e.target.value) || 1 }))} />
          </Field>

          <Field label="Ícono" hint="Si no hay foto">
            <Input value={form.icon} maxLength={4} className="text-center text-xl"
                   onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))} />
          </Field>

          <Field label="Descripción" span hint="Marca, talle, color, composición">
            <TextArea rows={2} value={form.description ?? ""}
                      placeholder="Campera de jean Levi's, talle 44, azul oscuro."
                      onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </Field>

          <Field label="Detalle que ve el cliente" span
                 hint="Origen, plazo, garantía, qué incluye. Es lo que responde sus dudas antes de pagar.">
            <TextArea rows={3} value={form.detalle ?? ""}
                      placeholder="Original Bosch. 15 a 20 días desde Alemania. 6 meses de garantía. Incluye envío puerta a puerta."
                      onChange={(e) => setForm((f) => ({ ...f, detalle: e.target.value }))} />
          </Field>

          {/* ── Fotos ─────────────────────────────────────────── */}
          <div className="sm:col-span-2">
            <div className="mb-3 flex items-center justify-between">
              <label className="ag-label">Fotos ({fotos.length})</label>
              <Btn size="xs" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? "Subiendo…" : "+ Agregar fotos"}
              </Btn>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
                     onChange={subirFotos} />
            </div>
            {fotos.length > 0 ? (
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {fotos.map((url, i) => (
                  <div key={url} className="group relative aspect-square">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Foto ${i + 1}`}
                         className={`h-full w-full border object-cover ${url === form.image ? "border-acento" : "border-line"}`} />
                    <button type="button" onClick={() => quitarFoto(url)}
                            className="absolute inset-0 flex items-center justify-center bg-black/70 opacity-0 transition-opacity group-hover:opacity-100">
                      <span className="bg-sale px-2 py-1 font-cond text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-white">
                        Quitar
                      </span>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()}
                      className="w-full border border-dashed border-line px-6 py-9 text-center transition-colors hover:border-acento">
                <p className="ag-label">{uploading ? "Subiendo…" : "Click para subir fotos"}</p>
                <p className="mt-1.5 text-sm font-light text-dim">
                  La primera es la principal · JPG, PNG, WEBP
                </p>
              </button>
            )}
          </div>

          {/* El link, cuando ya existe */}
          {editingId && (
            <div className="sm:col-span-2 border border-acento/30 bg-acento/5 p-5">
              <p className="ag-eyebrow mb-2 text-acentohi">El link del cliente</p>
              <p className="ag-mono break-all text-[0.85rem] text-chalk">
                {linkDe(piezas.find((x) => x.id === editingId) ?? ({} as Product))}
              </p>
            </div>
          )}
        </div>
      </Modal>

      <Confirm
        open={borrar !== null}
        title="¿Borrar la pieza a pedido?"
        body={`«${borrar?.title ?? ""}» va a dejar de existir y el link que le mandaste al cliente deja de abrir. Si ya te la pagó, el pedido conserva su copia del nombre y el precio.`}
        confirmLabel="Sí, borrar"
        onCancel={() => setBorrar(null)}
        onConfirm={() => borrar && eliminar(borrar)}
      />
    </Page>
  );
}

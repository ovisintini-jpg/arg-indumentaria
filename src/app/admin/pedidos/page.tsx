"use client";

import { useState, useEffect, useMemo, Fragment } from "react";
import { supabase } from "@/lib/supabase";
import {
  Page, PageHead, StatRow, Stat, Input, Select, StatusSelect, Badge,
  TableWrap, THead, Td, Empty, ErrorState, Loading, Confirm, Note, Tone,
  SIN_RESPUESTA, fmtARS, fmtARS2, fmtDate,
} from "@/components/admin/ui";

interface OrderRow {
  id:             string;
  order_number:   string;
  customer_name:  string;
  customer_email: string;
  item_count:     number;
  total:          number;
  status:         string;
  payment_status: string;
  payment_method: string;
  created_at:     string;
}

interface OrderItem {
  id: string; title: string; icon: string; image: string | null;
  price: number; quantity: number;
}

interface OrderDetail {
  shipping_name:        string;
  shipping_address:     string;
  shipping_city:        string;
  shipping_province:    string | null;
  shipping_postal_code: string | null;
  notes:                string | null;
  payment_method:       string;
  subtotal:             number;
  shipping_cost:        number;
  total:                number;
  items:                OrderItem[];
}

const STATUS_LABEL: Record<string, string> = {
  pending:    "Pendiente",
  confirmed:  "Confirmado",
  processing: "En proceso",
  shipped:    "Enviado",
  delivered:  "Entregado",
  cancelled:  "Cancelado",
};

const STATUS_TONE: Record<string, Tone> = {
  pending:    "warn",
  confirmed:  "acento",
  processing: "acento",
  shipped:    "acento",
  delivered:  "ok",
  cancelled:  "sale",
};

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  pending:  "Pendiente",
  paid:     "Pagado",
  failed:   "Fallido",
  refunded: "Reembolsado",
};

const PAYMENT_TONE: Record<string, Tone> = {
  pending: "warn", paid: "ok", failed: "sale", refunded: "mute",
};

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  transferencia: "Transferencia",
  efectivo:      "Efectivo",
  mercadopago:   "MercadoPago",
  tiendanube:    "Tienda Nube",
};

// Medios que en el futuro se cobran vía API (el webhook confirma el pago solo).
// Hoy ninguno está integrado — el checkout solo ofrece transferencia y efectivo,
// así que todos se marcan a mano acá. Cuando se conecte Mercado Pago o Tienda
// Nube, su webhook solo tiene que hacer update({ payment_status: 'paid' }) sobre
// esta misma columna: no hay que tocar nada más del panel.
const ELECTRONIC_PAYMENT_METHODS = ["mercadopago", "tiendanube"];

export default function PedidosPage() {
  const [orders,        setOrders]        = useState<OrderRow[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<OrderRow | null>(null);
  const [expandedId,    setExpandedId]    = useState<string | null>(null);
  const [detailCache,   setDetailCache]   = useState<Record<string, OrderDetail>>({});
  const [detailLoading, setDetailLoading] = useState<string | null>(null);
  const [search,        setSearch]        = useState("");
  const [filterStatus,  setFilterStatus]  = useState("all");
  const [loadError,     setLoadError]     = useState("");
  const [verificando,   setVerificando]   = useState<string | null>(null);
  const [verificarMsg,  setVerificarMsg]  = useState<Record<string, string>>({});

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from("orders_overview")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) setLoadError(error.message);
      else if (data) { setOrders(data as OrderRow[]); setLoadError(""); }
    } catch {
      setLoadError(SIN_RESPUESTA);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Red de seguridad: si la base no contesta, la pantalla no queda girando
    const t = setTimeout(() => { setLoading(false); setLoadError(SIN_RESPUESTA); }, 10000);
    fetchOrders().finally(() => clearTimeout(t));
    const channel = supabase
      .channel("orders-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, fetchOrders)
      .subscribe();
    return () => { clearTimeout(t); supabase.removeChannel(channel); };
  }, []);

  const toggleDetail = async (orderId: string) => {
    if (expandedId === orderId) { setExpandedId(null); return; }
    setExpandedId(orderId);
    if (detailCache[orderId]) return;

    setDetailLoading(orderId);
    const [{ data: orderData }, { data: itemsData }] = await Promise.all([
      supabase.from("orders").select(
        "shipping_name,shipping_address,shipping_city,shipping_province,shipping_postal_code,notes,payment_method,subtotal,shipping_cost,total"
      ).eq("id", orderId).single(),
      supabase.from("order_items").select("id,title,icon,image,price,quantity").eq("order_id", orderId),
    ]);

    if (orderData) {
      setDetailCache((prev) => ({
        ...prev,
        [orderId]: { ...orderData, items: (itemsData ?? []) as OrderItem[] },
      }));
    }
    setDetailLoading(null);
  };

  const updateStatus = async (id: string, status: string) => {
    setOrders((prev) => prev.map((o) => o.id === id ? { ...o, status } : o));
    await supabase.from("orders").update({ status }).eq("id", id);
  };

  const updatePaymentStatus = async (id: string, payment_status: string) => {
    setOrders((prev) => prev.map((o) => o.id === id ? { ...o, payment_status } : o));
    await supabase.from("orders").update({ payment_status }).eq("id", id);
  };

  // Respaldo manual para cuando el webhook de Mercado Pago no llega o llega
  // con una firma que no valida (pasa seguido en modo de prueba — ver
  // claude/pagos-2026-09-05.md, sección 7). Consulta directo a la API de
  // Mercado Pago por este pedido y actualiza el estado real, sin esperar
  // ningún aviso.
  const verificarPago = async (id: string) => {
    setVerificando(id);
    setVerificarMsg((prev) => ({ ...prev, [id]: "" }));
    try {
      const res = await fetch("/api/admin/mercadopago/verificar-pago", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setVerificarMsg((prev) => ({ ...prev, [id]: data?.error || "No se pudo verificar." }));
      } else if (!data.updated) {
        setVerificarMsg((prev) => ({
          ...prev,
          [id]: data.message || "Todavía no hay pago registrado en Mercado Pago.",
        }));
      } else {
        setOrders((prev) => prev.map((o) => o.id === id ? { ...o, payment_status: data.status } : o));
        setVerificarMsg((prev) => ({ ...prev, [id]: "" }));
      }
    } catch {
      setVerificarMsg((prev) => ({ ...prev, [id]: SIN_RESPUESTA }));
    } finally {
      setVerificando(null);
    }
  };

  const deleteOrder = async (id: string) => {
    setOrders((prev) => prev.filter((o) => o.id !== id));
    setConfirmDelete(null);
    if (expandedId === id) setExpandedId(null);
    await supabase.from("orders").delete().eq("id", id);
  };

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (filterStatus !== "all" && o.status !== filterStatus) return false;
      if (!q) return true;
      return (
        (o.order_number   ?? "").toLowerCase().includes(q) ||
        (o.customer_name  ?? "").toLowerCase().includes(q) ||
        (o.customer_email ?? "").toLowerCase().includes(q)
      );
    });
  }, [orders, search, filterStatus]);

  const activos    = orders.filter((o) => o.status !== "cancelled");
  const facturado  = activos.reduce((a, o) => a + Number(o.total ?? 0), 0);
  const porCobrar  = activos
    .filter((o) => o.payment_status !== "paid")
    .reduce((a, o) => a + Number(o.total ?? 0), 0);

  return (
    <Page>
      <PageHead
        title="Pedidos"
        sub="Se actualiza solo: cuando entra un pedido nuevo aparece acá sin recargar."
      />

      <StatRow cols={5}>
        <Stat label="Pedidos"     value={orders.length} />
        <Stat label="Pendientes"  value={orders.filter((o) => o.status === "pending").length} tone="warn" />
        <Stat label="Entregados"  value={orders.filter((o) => o.status === "delivered").length} tone="ok" />
        <Stat label="Facturado"   value={fmtARS(facturado)} hint="sin cancelados" tone="acento" />
        <Stat label="Por cobrar"  value={fmtARS(porCobrar)} hint="pago no confirmado" tone={porCobrar > 0 ? "warn" : "mute"} />
      </StatRow>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por N.º de pedido, cliente o email…"
          className="min-w-[260px] flex-1"
        />
        <div className="w-full sm:w-56">
          <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="all">Todos los estados</option>
            {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="border border-line bg-panel"><Loading label="Cargando pedidos" /></div>
      ) : loadError && orders.length === 0 ? (
        <div className="border border-line bg-panel"><ErrorState msg={loadError} /></div>
      ) : visible.length === 0 ? (
        <div className="border border-line bg-panel">
          <Empty
            title={orders.length === 0 ? "Todavía no entró ningún pedido" : "Ningún pedido coincide"}
            sub={orders.length === 0
              ? "Cuando alguien termine una compra en la tienda, va a aparecer acá al instante."
              : "Probá con otro término o cambiá el filtro de estado."}
          />
        </div>
      ) : (
        <TableWrap>
          <THead cols={["N.º", "Cliente", "Items", "Total", "Pago", "Estado", "Fecha", ""]} />
          <tbody>
            {visible.map((o) => {
              const isExpanded = expandedId === o.id;
              const isLoadingDetail = detailLoading === o.id;
              const detail = detailCache[o.id];

              return (
                <Fragment key={o.id}>
                  <tr className={`border-b border-line/70 transition-colors ${isExpanded ? "bg-raise" : "hover:bg-raise/50"}`}>
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <button
                          onClick={() => toggleDetail(o.id)}
                          title={isExpanded ? "Cerrar detalle" : "Ver detalle"}
                          className={`flex h-7 w-7 shrink-0 items-center justify-center border text-[0.6rem] transition-colors ${
                            isExpanded ? "border-acento text-acentohi" : "border-line text-dim hover:border-linehi hover:text-mute"
                          }`}
                        >
                          {isLoadingDetail ? "·" : isExpanded ? "▼" : "▶"}
                        </button>
                        <span className="ag-mono font-semibold text-acentohi">{o.order_number}</span>
                      </div>
                    </Td>

                    <Td>
                      <div className="max-w-[260px]">
                      <p className="truncate font-display text-[0.92rem] font-extrabold uppercase leading-tight">
                        {o.customer_name || "Invitado"}
                      </p>
                      {o.customer_email && (
                        <p className="mt-0.5 truncate text-sm font-light text-dim">{o.customer_email}</p>
                      )}
                      </div>
                    </Td>

                    <Td><span className="ag-num text-mute">{o.item_count}</span></Td>

                    <Td><span className="ag-num font-display font-extrabold text-acentohi">{fmtARS(o.total)}</span></Td>

                    <Td>
                      <StatusSelect
                        tone={PAYMENT_TONE[o.payment_status] ?? "mute"}
                        value={o.payment_status}
                        onChange={(e) => updatePaymentStatus(o.id, e.target.value)}
                        title={
                          ELECTRONIC_PAYMENT_METHODS.includes(o.payment_method)
                            ? "Medio electrónico: cuando esté integrado se va a actualizar solo"
                            : "Verificá el ingreso del dinero antes de marcarlo como pagado"
                        }
                      >
                        {Object.entries(PAYMENT_STATUS_LABEL).map(([v, l]) => (
                          <option key={v} value={v} className="bg-panel text-chalk">{l}</option>
                        ))}
                      </StatusSelect>
                      <p className="ag-label mt-1.5">
                        {PAYMENT_METHOD_LABEL[o.payment_method] ?? o.payment_method ?? "—"}
                      </p>
                      {o.payment_method === "mercadopago" && o.payment_status === "pending" && (
                        <div className="mt-1.5">
                          <button
                            onClick={() => verificarPago(o.id)}
                            disabled={verificando === o.id}
                            className="border border-line px-2 py-1 text-[0.68rem] font-semibold uppercase tracking-wide text-dim transition-colors hover:border-linehi hover:text-mute disabled:opacity-50"
                          >
                            {verificando === o.id ? "Verificando…" : "Verificar pago"}
                          </button>
                          {verificarMsg[o.id] && (
                            <p className="ag-label mt-1 max-w-[180px] normal-case leading-snug text-warn">
                              {verificarMsg[o.id]}
                            </p>
                          )}
                        </div>
                      )}
                    </Td>

                    <Td>
                      <StatusSelect
                        tone={STATUS_TONE[o.status] ?? "mute"}
                        value={o.status}
                        onChange={(e) => updateStatus(o.id, e.target.value)}
                      >
                        {Object.entries(STATUS_LABEL).map(([v, l]) => (
                          <option key={v} value={v} className="bg-panel text-chalk">{l}</option>
                        ))}
                      </StatusSelect>
                    </Td>

                    <Td><span className="ag-mono text-dim">{fmtDate(o.created_at)}</span></Td>

                    <Td className="text-right">
                      <button
                        onClick={() => setConfirmDelete(o)}
                        title="Eliminar pedido"
                        className="px-1 text-dim transition-colors hover:text-sale"
                      >
                        ✕
                      </button>
                    </Td>
                  </tr>

                  {isExpanded && (
                    <tr className="border-b border-line bg-ink/60">
                      <td colSpan={8} className="px-5 py-6">
                        {isLoadingDetail || !detail ? (
                          <Loading label="Cargando detalle" />
                        ) : (
                          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">

                            <div>
                              <p className="ag-eyebrow mb-3">Productos del pedido</p>
                              <div className="space-y-px">
                                {detail.items.map((item) => (
                                  <div key={item.id} className="flex items-center gap-3 border border-line bg-panel px-4 py-3">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden border border-line bg-ink">
                                      {item.image
                                        // eslint-disable-next-line @next/next/no-img-element
                                        ? <img src={item.image} alt="" className="h-full w-full object-cover" />
                                        : <span>{item.icon}</span>}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate font-display text-[0.9rem] font-extrabold uppercase leading-tight">
                                        {item.title}
                                      </p>
                                      <p className="ag-label mt-1 normal-case tracking-[0.08em]">
                                        {fmtARS2(item.price)} c/u × {item.quantity}
                                      </p>
                                    </div>
                                    <span className="ag-num shrink-0 font-display font-extrabold text-acentohi">
                                      {fmtARS2(item.price * item.quantity)}
                                    </span>
                                  </div>
                                ))}
                              </div>

                              <div className="mt-5 border-t border-line pt-4">
                                <div className="flex justify-between py-1">
                                  <span className="ag-label">Subtotal</span>
                                  <span className="ag-num text-mute">{fmtARS2(detail.subtotal)}</span>
                                </div>
                                <div className="flex justify-between py-1">
                                  <span className="ag-label">Envío</span>
                                  <span className="ag-num text-mute">
                                    {detail.shipping_cost > 0 ? fmtARS2(detail.shipping_cost) : "A coordinar"}
                                  </span>
                                </div>
                                <div className="mt-2 flex items-center justify-between border-t border-line pt-3">
                                  <span className="ag-eyebrow text-chalk">Total</span>
                                  <span className="ag-num font-display text-xl font-extrabold text-acentohi">
                                    {fmtARS2(detail.total)}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="space-y-px">
                              <div className="border border-line bg-panel p-5">
                                <p className="ag-eyebrow mb-3">Envío</p>
                                <p className="font-display text-[0.95rem] font-extrabold uppercase leading-tight">
                                  {detail.shipping_name}
                                </p>
                                <p className="mt-2 font-light leading-relaxed text-mute">
                                  {detail.shipping_address}<br />
                                  {detail.shipping_city}
                                  {detail.shipping_province ? `, ${detail.shipping_province}` : ""}
                                  {detail.shipping_postal_code ? ` (CP ${detail.shipping_postal_code})` : ""}
                                </p>
                              </div>

                              <div className="border border-line bg-panel p-5">
                                <p className="ag-eyebrow mb-2.5">Medio de pago</p>
                                <Badge tone="acento">
                                  {PAYMENT_METHOD_LABEL[detail.payment_method] ?? detail.payment_method ?? "—"}
                                </Badge>
                              </div>

                              {detail.notes && (
                                <div className="border border-line bg-panel p-5">
                                  <p className="ag-eyebrow mb-2.5">Notas del cliente</p>
                                  <p className="font-light leading-relaxed text-mute">{detail.notes}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </TableWrap>
      )}

      <Note>{visible.length} de {orders.length} pedidos · el estado de pago de transferencia y efectivo se marca a mano</Note>

      <Confirm
        open={confirmDelete !== null}
        title="¿Eliminar el pedido?"
        body={`Se borra ${confirmDelete?.order_number ?? "el pedido"} con todos sus items. Para un pedido que no prosperó suele ser mejor pasarlo a «Cancelado» y conservar el registro.`}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && deleteOrder(confirmDelete.id)}
      />
    </Page>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useUser } from "@/context/UserContext";
import { supabase } from "@/lib/supabase";
import { Icon } from "@/components/Icons";

interface UserProfile {
  full_name:            string;
  phone:                string;
  dni:                  string;
  address_street:       string;
  address_neighborhood: string;
  address_city:         string;
  address_province:     string;
  address_zip:          string;
}

interface Order {
  id:             string;
  order_number:   string;
  status:         string;
  payment_status: string;
  total:          number;
  created_at:     string;
  items: { title: string; quantity: number; price: number; image?: string }[];
}

interface ReviewRow {
  id:       string;
  order_id: string;
  stars:    number;
  body:     string;
  status:   "pending" | "verified" | "blocked";
}

const money = (n: number) => `$${Number(n).toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;

const CHIP = "inline-block border px-2.5 py-1 font-cond text-[0.68rem] font-semibold uppercase tracking-[0.16em]";

const REVIEW_STATUS: Record<ReviewRow["status"], { label: string; cls: string }> = {
  pending:  { label: "En revisión",   cls: "text-warn border-warn/40 bg-warn/10" },
  verified: { label: "Publicada",     cls: "text-ok   border-ok/40   bg-ok/10"   },
  blocked:  { label: "No publicada",  cls: "text-sale border-sale/40 bg-sale/10" },
};

const EMPTY_PROFILE: UserProfile = {
  full_name: "", phone: "", dni: "",
  address_street: "", address_neighborhood: "", address_city: "", address_province: "", address_zip: "",
};

const PROVINCIAS = [
  "Buenos Aires","CABA","Catamarca","Chaco","Chubut","Córdoba","Corrientes",
  "Entre Ríos","Formosa","Jujuy","La Pampa","La Rioja","Mendoza","Misiones",
  "Neuquén","Río Negro","Salta","San Juan","San Luis","Santa Cruz","Santa Fe",
  "Santiago del Estero","Tierra del Fuego","Tucumán",
];

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  pending:    { label: "Pendiente",  cls: "text-warn   border-warn/40   bg-warn/10"   },
  confirmed:  { label: "Confirmado", cls: "text-acentohi border-acento/40   bg-acento/10"   },
  processing: { label: "En proceso", cls: "text-acentohi border-acento/40   bg-acento/10"   },
  shipped:    { label: "Enviado",    cls: "text-acentohi border-acento/40   bg-acento/10"   },
  delivered:  { label: "Entregado",  cls: "text-ok     border-ok/40     bg-ok/10"     },
  cancelled:  { label: "Cancelado",  cls: "text-sale   border-sale/40   bg-sale/10"   },
};

function Campo({
  label, span, children,
}: { label: string; span?: boolean; children: React.ReactNode }) {
  return (
    <div className={span ? "sm:col-span-2" : undefined}>
      <label className="ag-label mb-2 block">{label}</label>
      {children}
    </div>
  );
}

function Estrellas({ n }: { n: number }) {
  return (
    <span className="whitespace-nowrap" aria-label={`${n} de 5 estrellas`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={i < n ? "text-acentohi" : "text-line"}>★</span>
      ))}
    </span>
  );
}

interface AccountModalProps {
  isOpen:      boolean;
  initialTab?: "datos" | "compras";
  onClose:     () => void;
}

export default function AccountModal({ isOpen, initialTab = "datos", onClose }: AccountModalProps) {
  const { user, signOut } = useUser();

  const [tab,     setTab]     = useState<"datos" | "compras">(initialTab);
  const [profile, setProfile] = useState<UserProfile>(EMPTY_PROFILE);
  const [orders,  setOrders]  = useState<Order[]>([]);
  const [reviews, setReviews] = useState<Record<string, ReviewRow>>({});

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingOrders,  setLoadingOrders]  = useState(false);
  const [saving,         setSaving]         = useState(false);
  const [saveMsg,        setSaveMsg]        = useState("");
  const [saveOk,         setSaveOk]         = useState(false);

  // Formulario de reseña abierto (order_id) + su estado local
  const [reviewOpenFor, setReviewOpenFor]   = useState<string | null>(null);
  const [reviewStars,   setReviewStars]     = useState(5);
  const [reviewText,    setReviewText]      = useState("");
  const [reviewSending, setReviewSending]   = useState(false);
  const [reviewError,   setReviewError]     = useState("");

  useEffect(() => {
    if (isOpen) setTab(initialTab);
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (!isOpen || !user) return;
    setLoadingProfile(true);
    supabase
      .from("user_profiles")
      .select("*")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data) setProfile({
          full_name:            data.full_name            ?? "",
          phone:                data.phone                ?? "",
          dni:                  data.dni                  ?? "",
          address_street:       data.address_street       ?? "",
          address_neighborhood: data.address_neighborhood ?? "",
          address_city:         data.address_city         ?? "",
          address_province:     data.address_province     ?? "",
          address_zip:          data.address_zip          ?? "",
        });
        setLoadingProfile(false);
      });
  }, [isOpen, user]);

  useEffect(() => {
    if (!isOpen || tab !== "compras" || !user) return;
    setLoadingOrders(true);
    supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(async ({ data }) => {
        const mapped: Order[] = (data ?? []).map((o: Record<string, unknown>) => ({
          id:             o.id             as string,
          order_number:   o.order_number   as string,
          status:         o.status         as string,
          payment_status: o.payment_status as string,
          total:          o.total          as number,
          created_at:     o.created_at     as string,
          items: ((o.order_items as Record<string, unknown>[]) ?? []).map((i) => ({
            title:    i.title    as string,
            quantity: i.quantity as number,
            price:    i.price    as number,
            image:    i.image    as string | undefined,
          })),
        }));
        setOrders(mapped);

        const { data: reviewRows } = await supabase
          .from("reviews")
          .select("id, order_id, stars, body, status")
          .eq("user_id", user.id);

        const map: Record<string, ReviewRow> = {};
        (reviewRows as ReviewRow[] ?? []).forEach((r) => { map[r.order_id] = r; });
        setReviews(map);

        setLoadingOrders(false);
      });
  }, [isOpen, tab, user]);

  // Enviar reseña de un pedido entregado
  const submitReview = async (order: Order) => {
    if (!user) return;
    if (reviewText.trim().length === 0) {
      setReviewError("Escribí un comentario antes de enviar.");
      return;
    }
    setReviewSending(true);
    setReviewError("");

    const customerName = profile.full_name || user.email?.split("@")[0] || "Cliente";

    const { data, error } = await supabase
      .from("reviews")
      .insert({
        order_id:      order.id,
        user_id:       user.id,
        customer_name: customerName,
        stars:         reviewStars,
        body:          reviewText.trim(),
        status:        "pending",
      })
      .select("id, order_id, stars, body, status")
      .single();

    setReviewSending(false);

    if (error || !data) {
      setReviewError("No se pudo enviar la reseña. Probá de nuevo.");
      return;
    }

    setReviews((prev) => ({ ...prev, [order.id]: data as ReviewRow }));
    setReviewOpenFor(null);
    setReviewStars(5);
    setReviewText("");
  };

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true); setSaveMsg("");
    const { error } = await supabase
      .from("user_profiles")
      .upsert({ id: user.id, ...profile }, { onConflict: "id" });
    setSaving(false);
    setSaveOk(!error);
    setSaveMsg(error ? "No se pudo guardar. Probá de nuevo." : "Datos guardados.");
    setTimeout(() => setSaveMsg(""), 3000);
  };

  const handleSignOut = async () => {
    await signOut();
    onClose();
  };

  if (!isOpen || !user) return null;

  const displayName = profile.full_name || user.email?.split("@")[0] || "Tu cuenta";

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm" onClick={onClose} />

      <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6">
        <div className="pointer-events-auto flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden border border-line bg-panel">
          <div className="ag-rail shrink-0" aria-hidden="true" />

          {/* Cabecera */}
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-6 py-5 md:px-8 md:py-6">
            <div className="min-w-0">
              <div className="ag-tick mb-3" aria-hidden="true"><i /><i /><i /></div>
              <p className="ag-eyebrow mb-1.5">Mi cuenta</p>
              <h2 className="truncate font-display text-[1.3rem] font-extrabold uppercase tracking-[-0.02em]">
                {displayName}
              </h2>
              <p className="mt-1 truncate text-[0.85rem] font-light text-dim">{user.email}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={handleSignOut}
                className="border border-line px-3.5 py-2 font-cond text-[0.78rem] font-semibold uppercase tracking-[0.16em] text-dim transition-colors hover:border-sale hover:text-sale"
              >
                Salir
              </button>
              <button
                onClick={onClose}
                aria-label="Cerrar"
                className="grid h-9 w-9 place-items-center border border-line text-mute transition-colors hover:border-linehi hover:text-chalk"
              >
                <Icon name="close" size={16} />
              </button>
            </div>
          </div>

          {/* Solapas */}
          <div className="flex shrink-0 border-b border-line">
            {(["datos", "compras"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 border-b-2 py-3.5 font-cond text-[0.88rem] font-semibold uppercase tracking-[0.18em] transition-colors ${
                  tab === t
                    ? "border-b-acento text-chalk"
                    : "border-b-transparent text-dim hover:text-mute"
                }`}
              >
                {t === "datos" ? "Mis datos" : "Mis compras"}
              </button>
            ))}
          </div>

          {/* Contenido */}
          <div className="custom-scrollbar flex-1 overflow-y-auto px-6 py-7 md:px-8">

            {/* ── MIS DATOS ── */}
            {tab === "datos" && (
              loadingProfile ? (
                <div className="flex items-center justify-center gap-3 py-16">
                  <span className="h-1.5 w-1.5 animate-pulse bg-acento" />
                  <p className="ag-label">Cargando tus datos…</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">

                  <Campo label="Nombre completo" span>
                    <input
                      type="text" value={profile.full_name}
                      onChange={(e) => setProfile((p) => ({ ...p, full_name: e.target.value }))}
                      placeholder="Como figura en tu documento" className="ag-input"
                    />
                  </Campo>

                  <Campo label="Teléfono / WhatsApp">
                    <input
                      type="tel" value={profile.phone}
                      onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
                      placeholder="+54 9 351 000-0000" className="ag-input"
                    />
                  </Campo>

                  <Campo label="DNI / CUIL">
                    <input
                      type="text" value={profile.dni}
                      onChange={(e) => setProfile((p) => ({ ...p, dni: e.target.value }))}
                      placeholder="Para la factura" className="ag-input"
                    />
                  </Campo>

                  <div className="border-t border-line pt-5 sm:col-span-2">
                    <p className="ag-eyebrow">Dirección de envío</p>
                    <p className="mt-1.5 text-[0.85rem] font-light text-dim">
                      La cargamos sola en el checkout, así no la escribís cada vez.
                    </p>
                  </div>

                  <Campo label="Calle y número" span>
                    <input
                      type="text" value={profile.address_street}
                      onChange={(e) => setProfile((p) => ({ ...p, address_street: e.target.value }))}
                      placeholder="Av. Colón 1234, piso 3 depto B" className="ag-input"
                    />
                  </Campo>

                  <Campo label="Barrio" span>
                    <input
                      type="text" value={profile.address_neighborhood}
                      onChange={(e) => setProfile((p) => ({ ...p, address_neighborhood: e.target.value }))}
                      placeholder="Ej: Nueva Córdoba" className="ag-input"
                    />
                  </Campo>

                  <Campo label="Ciudad">
                    <input
                      type="text" value={profile.address_city}
                      onChange={(e) => setProfile((p) => ({ ...p, address_city: e.target.value }))}
                      placeholder="Ej: Córdoba" className="ag-input"
                    />
                  </Campo>

                  <Campo label="Provincia">
                    <select
                      value={profile.address_province}
                      onChange={(e) => setProfile((p) => ({ ...p, address_province: e.target.value }))}
                      className="ag-input cursor-pointer"
                    >
                      <option value="">— Seleccioná —</option>
                      {PROVINCIAS.map((pv) => <option key={pv} value={pv}>{pv}</option>)}
                    </select>
                  </Campo>

                  <Campo label="Código postal">
                    <input
                      type="text" value={profile.address_zip}
                      onChange={(e) => setProfile((p) => ({ ...p, address_zip: e.target.value }))}
                      placeholder="Ej: 5000" className="ag-input"
                    />
                  </Campo>

                  <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5 sm:col-span-2">
                    <button onClick={saveProfile} disabled={saving} className="ag-btn ag-btn-acento ag-btn-sm">
                      {saving ? "Guardando…" : "Guardar datos"}
                    </button>
                    <button onClick={onClose} className="ag-btn ag-btn-ghost ag-btn-sm">
                      Volver
                    </button>
                    {saveMsg && (
                      <p className={`font-cond text-[0.85rem] font-semibold uppercase tracking-[0.14em] ${saveOk ? "text-ok" : "text-sale"}`}>
                        {saveMsg}
                      </p>
                    )}
                  </div>
                </div>
              )
            )}

            {/* ── MIS COMPRAS ── */}
            {tab === "compras" && (
              loadingOrders ? (
                <div className="flex items-center justify-center gap-3 py-16">
                  <span className="h-1.5 w-1.5 animate-pulse bg-acento" />
                  <p className="ag-label">Buscando tus pedidos…</p>
                </div>
              ) : orders.length === 0 ? (
                <div className="py-16 text-center">
                  <span className="mx-auto mb-5 block w-fit text-dim"><Icon name="cart" size={44} /></span>
                  <p className="font-display text-[1.1rem] font-extrabold uppercase">
                    Todavía no compraste nada
                  </p>
                  <p className="mx-auto mt-2 max-w-[36ch] font-light leading-relaxed text-mute">
                    Cuando hagas tu primer pedido, lo vas a poder seguir desde acá.
                  </p>
                  <button onClick={onClose} className="ag-btn ag-btn-ghost ag-btn-sm mt-7">
                    Volver a la tienda
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {orders.map((order) => {
                    const st = STATUS_LABELS[order.status] ?? { label: order.status, cls: "text-mute border-line bg-raise" };
                    return (
                      <article key={order.id} className="border border-line bg-ink p-5">

                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="ag-mono text-[0.95rem] font-medium tracking-[0.06em] text-acentohi">
                              {order.order_number}
                            </p>
                            <p className="ag-label mt-1.5">
                              {new Date(order.created_at).toLocaleDateString("es-AR", {
                                day: "2-digit", month: "long", year: "numeric",
                              })}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`${CHIP} ${st.cls}`}>{st.label}</span>
                            <span className="ag-num font-display text-[1.1rem] font-extrabold tracking-[-0.03em]">
                              {money(order.total)}
                            </span>
                          </div>
                        </div>

                        <div className="mt-4 space-y-2 border-t border-line pt-4">
                          {order.items.map((item, i) => (
                            <div key={i} className="flex items-baseline gap-3">
                              <span className="min-w-0 flex-1 truncate font-display text-[0.88rem] font-bold uppercase leading-tight">
                                {item.title}
                              </span>
                              <span className="ag-num shrink-0 text-[0.82rem] text-dim">×{item.quantity}</span>
                              <span className="ag-num shrink-0 text-[0.88rem] text-mute">
                                {money(item.price * item.quantity)}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Reseña — solo pedidos entregados */}
                        {order.status === "delivered" && (
                          <div className="mt-4 border-t border-line pt-4">
                            {reviews[order.id] ? (
                              <div className="flex flex-wrap items-center gap-3">
                                <Estrellas n={reviews[order.id].stars} />
                                <span className={`${CHIP} ${REVIEW_STATUS[reviews[order.id].status].cls}`}>
                                  {REVIEW_STATUS[reviews[order.id].status].label}
                                </span>
                              </div>
                            ) : reviewOpenFor === order.id ? (
                              <div className="space-y-3">
                                <div>
                                  <p className="ag-label mb-2">Tu puntaje</p>
                                  <div className="flex gap-1.5">
                                    {Array.from({ length: 5 }).map((_, i) => (
                                      <button
                                        key={i}
                                        type="button"
                                        onClick={() => setReviewStars(i + 1)}
                                        aria-label={`${i + 1} estrellas`}
                                        className={`text-[1.6rem] leading-none transition-colors ${
                                          i < reviewStars ? "text-acentohi" : "text-line hover:text-dim"
                                        }`}
                                      >
                                        ★
                                      </button>
                                    ))}
                                  </div>
                                </div>

                                <textarea
                                  value={reviewText}
                                  onChange={(e) => setReviewText(e.target.value)}
                                  rows={3}
                                  placeholder="¿Llegó bien? ¿La pieza era la correcta? Contanos."
                                  className="ag-input resize-none"
                                />

                                {reviewError && (
                                  <p className="text-[0.88rem] font-light text-sale">{reviewError}</p>
                                )}

                                <div className="flex flex-wrap items-center gap-3">
                                  <button
                                    onClick={() => submitReview(order)}
                                    disabled={reviewSending}
                                    className="ag-btn ag-btn-acento ag-btn-sm"
                                  >
                                    {reviewSending ? "Enviando…" : "Enviar reseña"}
                                  </button>
                                  <button
                                    onClick={() => { setReviewOpenFor(null); setReviewError(""); setReviewText(""); setReviewStars(5); }}
                                    className="font-cond text-[0.8rem] font-semibold uppercase tracking-[0.16em] text-dim transition-colors hover:text-chalk"
                                  >
                                    Cancelar
                                  </button>
                                </div>

                                <p className="text-[0.8rem] font-light text-dim">
                                  La revisamos antes de publicarla en la tienda.
                                </p>
                              </div>
                            ) : (
                              <button
                                onClick={() => setReviewOpenFor(order.id)}
                                className="font-cond text-[0.82rem] font-semibold uppercase tracking-[0.16em] text-acentohi transition-colors hover:text-chalk"
                              >
                                ★ Dejar una reseña
                              </button>
                            )}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </>
  );
}

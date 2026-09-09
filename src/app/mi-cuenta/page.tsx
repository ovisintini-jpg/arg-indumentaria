"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@/context/UserContext";
import { supabase } from "@/lib/supabase";
import Brand from "@/components/Brand";
import { Icon } from "@/components/Icons";

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface UserProfile {
  full_name:        string;
  phone:            string;
  dni:              string;
  address_street:   string;
  address_city:     string;
  address_province: string;
  address_zip:      string;
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
  pending:  { label: "En revisión",  cls: "text-warn border-warn/40 bg-warn/10" },
  verified: { label: "Publicada",    cls: "text-ok   border-ok/40   bg-ok/10"   },
  blocked:  { label: "No publicada", cls: "text-sale border-sale/40 bg-sale/10" },
};

const EMPTY_PROFILE: UserProfile = {
  full_name:        "",
  phone:            "",
  dni:              "",
  address_street:   "",
  address_city:     "",
  address_province: "",
  address_zip:      "",
};

const PROVINCIAS = [
  "Buenos Aires","CABA","Catamarca","Chaco","Chubut","Córdoba","Corrientes",
  "Entre Ríos","Formosa","Jujuy","La Pampa","La Rioja","Mendoza","Misiones",
  "Neuquén","Río Negro","Salta","San Juan","San Luis","Santa Cruz","Santa Fe",
  "Santiago del Estero","Tierra del Fuego","Tucumán",
];

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  pending:    { label: "Pendiente",  cls: "text-warn   border-warn/40 bg-warn/10" },
  confirmed:  { label: "Confirmado", cls: "text-acentohi border-acento/40 bg-acento/10" },
  processing: { label: "En proceso", cls: "text-acentohi border-acento/40 bg-acento/10" },
  shipped:    { label: "Enviado",    cls: "text-acentohi border-acento/40 bg-acento/10" },
  delivered:  { label: "Entregado",  cls: "text-ok     border-ok/40   bg-ok/10"   },
  cancelled:  { label: "Cancelado",  cls: "text-sale   border-sale/40 bg-sale/10" },
};

function Campo({ label, span, children }: { label: string; span?: boolean; children: React.ReactNode }) {
  return (
    <div className={span ? "sm:col-span-2" : undefined}>
      <label className="ag-label mb-2 block">{label}</label>
      {children}
    </div>
  );
}

function Cargando({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16">
      <span className="h-1.5 w-1.5 animate-pulse bg-acento" />
      <p className="ag-label">{label}</p>
    </div>
  );
}

// ── Componente ────────────────────────────────────────────────────────────────
export default function MiCuentaPage() {
  return (
    <Suspense fallback={null}>
      <MiCuentaContent />
    </Suspense>
  );
}

function MiCuentaContent() {
  const { user, loading: authLoading, signOut } = useUser();
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [tab, setTab] = useState<"datos" | "compras">(
    searchParams.get("tab") === "compras" ? "compras" : "datos"
  );
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

  // Se incrementa cada vez que se hace click en la solapa "Mis compras"
  // (incluso si ya estaba activa) para poder refrescar pedidos a demanda,
  // por ejemplo después de que el admin cambia el estado de un pedido.
  const [refreshKey, setRefreshKey] = useState(0);

  // Redirigir si no está logueado
  useEffect(() => {
    if (!authLoading && !user) router.replace("/");
  }, [authLoading, user, router]);

  // Cargar perfil al montar
  useEffect(() => {
    if (!user) return;

    const fetchProfile = async () => {
      const { data } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (data) {
        setProfile({
          full_name:        data.full_name        ?? "",
          phone:            data.phone            ?? "",
          dni:              data.dni              ?? "",
          address_street:   data.address_street   ?? "",
          address_city:     data.address_city     ?? "",
          address_province: data.address_province ?? "",
          address_zip:      data.address_zip      ?? "",
        });
      }
      setLoadingProfile(false);
    };

    fetchProfile();
  }, [user]);

  // Cargar pedidos al cambiar al tab
  useEffect(() => {
    if (tab !== "compras" || !user) return;

    const fetchOrders = async () => {
      setLoadingOrders(true);
      const { data } = await supabase
        .from("customer_orders")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      setOrders((data as Order[]) ?? []);

      const { data: reviewRows } = await supabase
        .from("reviews")
        .select("id, order_id, stars, body, status")
        .eq("user_id", user.id);

      const map: Record<string, ReviewRow> = {};
      (reviewRows as ReviewRow[] ?? []).forEach((r) => { map[r.order_id] = r; });
      setReviews(map);

      setLoadingOrders(false);
    };

    fetchOrders();
  }, [tab, user, refreshKey]);

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

  // Guardar perfil
  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    setSaveMsg("");

    const { error } = await supabase
      .from("user_profiles")
      .upsert({ id: user.id, ...profile }, { onConflict: "id" });

    setSaving(false);
    setSaveOk(!error);
    setSaveMsg(error ? "No se pudo guardar. Probá de nuevo." : "Datos guardados.");
    setTimeout(() => setSaveMsg(""), 3000);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (authLoading || !user) return null;

  const displayName = profile.full_name || user.email?.split("@")[0] || "Tu cuenta";

  return (
    <main className="min-h-screen bg-ink pb-24">
      <div className="ag-rail" aria-hidden="true" />

      <header className="border-b border-line bg-[#0b0d10]">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-5 py-4 md:px-8">
          <button
            onClick={() => router.push("/")}
            className="font-cond text-[0.85rem] font-semibold uppercase tracking-[0.16em] text-dim transition-colors hover:text-chalk"
          >
            ← Tienda
          </button>
          <Brand size="sm" />
          <div className="hidden w-20 md:block" />
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-5 py-9 md:px-8 md:py-12">

        {/* Encabezado */}
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="ag-tick mb-4" aria-hidden="true"><i /><i /><i /></div>
            <p className="ag-eyebrow mb-2">Mi cuenta</p>
            <h1 className="truncate font-display text-[clamp(1.7rem,4vw,2.6rem)] font-extrabold uppercase leading-none">
              {displayName}
            </h1>
            <p className="mt-2.5 truncate text-[0.9rem] font-light text-dim">{user.email}</p>
          </div>
          <button
            onClick={signOut}
            className="shrink-0 border border-line px-4 py-2.5 font-cond text-[0.8rem] font-semibold uppercase tracking-[0.16em] text-dim transition-colors hover:border-sale hover:text-sale"
          >
            Cerrar sesión
          </button>
        </div>

        {/* Solapas */}
        <div className="mb-7 flex border-b border-line">
          {(["datos", "compras"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); if (t === "compras") setRefreshKey((k) => k + 1); }}
              className={`-mb-px border-b-2 px-6 py-3.5 font-cond text-[0.88rem] font-semibold uppercase tracking-[0.18em] transition-colors ${
                tab === t
                  ? "border-b-acento text-chalk"
                  : "border-b-transparent text-dim hover:text-mute"
              }`}
            >
              {t === "datos" ? "Mis datos" : "Mis compras"}
            </button>
          ))}
        </div>

        {/* ── MIS DATOS ─────────────────────────────────────────────── */}
        {tab === "datos" && (
          <section className="border border-line bg-panel p-6 md:p-8">
            {loadingProfile ? (
              <Cargando label="Cargando tus datos…" />
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
                    {PROVINCIAS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </Campo>

                <Campo label="Código postal">
                  <input
                    type="text" value={profile.address_zip}
                    onChange={(e) => setProfile((p) => ({ ...p, address_zip: e.target.value }))}
                    placeholder="Ej: 5000" className="ag-input"
                  />
                </Campo>

                <div className="flex flex-wrap items-center gap-4 border-t border-line pt-5 sm:col-span-2">
                  <button onClick={saveProfile} disabled={saving} className="ag-btn ag-btn-acento ag-btn-sm">
                    {saving ? "Guardando…" : "Guardar datos"}
                  </button>
                  {saveMsg && (
                    <p className={`font-cond text-[0.85rem] font-semibold uppercase tracking-[0.14em] ${saveOk ? "text-ok" : "text-sale"}`}>
                      {saveMsg}
                    </p>
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── MIS COMPRAS ───────────────────────────────────────────── */}
        {tab === "compras" && (
          <section>
            <div className="mb-4 flex justify-end">
              <button
                onClick={() => setRefreshKey((k) => k + 1)}
                disabled={loadingOrders}
                className="font-cond text-[0.8rem] font-semibold uppercase tracking-[0.16em] text-dim transition-colors hover:text-acentohi disabled:opacity-40"
              >
                ↻ Actualizar
              </button>
            </div>

            {loadingOrders ? (
              <div className="border border-line bg-panel"><Cargando label="Buscando tus pedidos…" /></div>
            ) : orders.length === 0 ? (
              <div className="border border-line bg-panel px-6 py-20 text-center">
                <span className="mx-auto mb-5 block w-fit text-dim"><Icon name="cart" size={48} /></span>
                <p className="font-display text-[1.15rem] font-extrabold uppercase">
                  Todavía no compraste nada
                </p>
                <p className="mx-auto mt-2.5 max-w-[38ch] font-light leading-relaxed text-mute">
                  Cuando hagas tu primer pedido, lo vas a poder seguir desde acá.
                </p>
                <button onClick={() => router.push("/")} className="ag-btn ag-btn-ghost ag-btn-sm mt-8">
                  Ver el catálogo
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.map((order) => {
                  const st = STATUS_LABELS[order.status] ?? { label: order.status, cls: "text-mute border-line bg-raise" };
                  return (
                    <article key={order.id} className="border border-line bg-panel p-5 md:p-6">

                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="ag-mono text-[0.98rem] font-medium tracking-[0.06em] text-acentohi">
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
                          <span className="ag-num font-display text-[1.15rem] font-extrabold tracking-[-0.03em]">
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
                              <span className="whitespace-nowrap">
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <span key={i} className={i < reviews[order.id].stars ? "text-acentohi" : "text-line"}>★</span>
                                ))}
                              </span>
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
            )}
          </section>
        )}
      </div>
    </main>
  );
}

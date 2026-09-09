"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/context/CartContext";
import { useUser } from "@/context/UserContext";
import { supabase } from "@/lib/supabase";
import Brand from "@/components/Brand";
import { Icon, productIcon } from "@/components/Icons";

interface ShippingForm {
  name: string; email: string; phone: string;
  address: string; neighborhood: string; city: string;
  province: string; zip: string; notes: string;
}

type PaymentMethod = "transferencia" | "efectivo" | "mercadopago" | "";

/** Lo que devuelve verificar_precios(): el precio y la disponibilidad
 *  reales, salgan del catálogo o de una pieza a pedido. */
interface FilaVerificada {
  id:          string;
  title:       string;
  price:       number;
  envio_costo: number;
  stock:       number;
  disponible:  boolean;
}

const PROVINCIAS = [
  "Buenos Aires","CABA","Catamarca","Chaco","Chubut","Córdoba","Corrientes",
  "Entre Ríos","Formosa","Jujuy","La Pampa","La Rioja","Mendoza","Misiones",
  "Neuquén","Río Negro","Salta","San Juan","San Luis","Santa Cruz","Santa Fe",
  "Santiago del Estero","Tierra del Fuego","Tucumán",
];

const EMPTY: ShippingForm = {
  name:"", email:"", phone:"",
  address:"", neighborhood:"", city:"", province:"", zip:"", notes:"",
};

const money = (n: number) => `$${n.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;

/* ── Piezas del formulario ─────────────────────────────────────── */

function Campo({
  label, req, span, hint, children,
}: {
  label: string; req?: boolean; span?: boolean; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className={span ? "sm:col-span-2" : undefined}>
      <label className="ag-label mb-2 block">
        {label}{req && <span className="ml-1 text-acentohi">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-[0.8rem] font-light text-dim">{hint}</p>}
    </div>
  );
}

function Paso({ n, titulo, children }: { n: string; titulo: string; children: React.ReactNode }) {
  return (
    <section className="border border-line bg-panel">
      <div className="flex items-center gap-4 border-b border-line px-5 py-4 md:px-7 md:py-5">
        <span className="ag-num font-display text-[1.6rem] font-extrabold leading-none text-dim">{n}</span>
        <h2 className="font-display text-[1.05rem] font-extrabold uppercase tracking-[-0.02em]">{titulo}</h2>
      </div>
      <div className="p-5 md:p-7">{children}</div>
    </section>
  );
}

export default function CheckoutPage() {
  const router = useRouter();
  const { items, totalPrice, clearCart, increment, decrement, removeItem } = useCart();
  const { user, loading: userLoading } = useUser();

  const [form,        setForm]        = useState<ShippingForm>(EMPTY);
  const [payment,     setPayment]     = useState<PaymentMethod>("");
  const [step,        setStep]        = useState<"form" | "success">("form");
  const [placing,     setPlacing]     = useState(false);
  const [error,       setError]       = useState("");
  const [orderNumber, setOrderNumber] = useState("");

  useEffect(() => {
    if (!userLoading && items.length === 0 && step !== "success") router.replace("/");
  }, [items.length, userLoading, step, router]);

  useEffect(() => {
    if (!user) return;
    supabase.from("user_profiles")
      .select("full_name,phone,address_street,address_neighborhood,address_city,address_province,address_zip")
      .eq("id", user.id).single()
      .then(({ data }) => {
        setForm((f) => ({
          ...f,
          name:         data?.full_name            ?? "",
          email:        user.email                 ?? "",
          phone:        data?.phone                ?? "",
          address:      data?.address_street       ?? "",
          neighborhood: data?.address_neighborhood ?? "",
          city:         data?.address_city         ?? "",
          province:     data?.address_province     ?? "",
          zip:          data?.address_zip          ?? "",
        }));
      });
  }, [user]);

  const set = (k: keyof ShippingForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  // ── Sanitización de texto (evita inyección de caracteres especiales) ──────
  const sanitize = (s: string, maxLen = 200) =>
    s.trim().slice(0, maxLen).replace(/[<>"'`]/g, "");

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
  const fieldValid = form.name.trim() && emailValid && form.address.trim() && form.city.trim() && payment;

  const placeOrder = async () => {
    setPlacing(true); setError("");
    try {
      // ── 1. Validar email ──────────────────────────────────────────────────
      if (!emailValid) throw new Error("El email ingresado no es válido.");

      // ── 2. Rate limiting: máximo 5 pedidos por email en 24 horas ─────────
      const { data: rateOk } = await supabase
        .rpc("check_order_rate_limit", { p_email: form.email.trim().toLowerCase() });
      if (rateOk === false) {
        throw new Error("Demasiados pedidos recientes desde este email. Intentá más tarde.");
      }

      // ── 3 y 4. Precio, stock y disponibilidad, todo contra la base ───────
      // Una sola llamada en vez del bucle de get_product_stock + el SELECT
      // de precios. Nunca confiamos en lo que trae el carrito del browser.
      //
      // verificar_precios() es SECURITY DEFINER a propósito: una pieza a
      // pedido está escondida por RLS y un SELECT normal no la traería.
      // Antes, cuando un producto no volvía, se usaba el precio del carrito
      // (`?? i.product.price`) — ahora el pedido se corta.
      const productIds = items.map((i) => i.product.id).filter(Boolean);

      const { data: rpcRows, error: rpcErr } = await supabase
        .rpc("verificar_precios", { p_ids: productIds });

      let verificados: FilaVerificada[];

      if (!rpcErr && rpcRows) {
        verificados = rpcRows as FilaVerificada[];
      } else {
        // Sin supabase/parches/pedidos-especiales.sql la función no existe.
        // Camino viejo: alcanza para el catálogo, que es todo lo que hay
        // hasta que corras el parche.
        const { data: realProducts, error: priceErr } = await supabase
          .from("products")
          .select("id, title, price, stock")
          .in("id", productIds);

        if (priceErr || !realProducts?.length) {
          throw new Error("No pudimos verificar los precios. Intentá nuevamente.");
        }

        verificados = realProducts.map((p) => ({
          id:          p.id    as string,
          title:       p.title as string,
          price:       Number(p.price),
          envio_costo: 0,
          stock:       Number(p.stock ?? 0),
          disponible:  true,
        }));
      }

      const porId = new Map(verificados.map((v) => [v.id, v]));

      for (const item of items) {
        const v = porId.get(item.product.id);

        // Si un producto no vuelve de la base, no seguimos. Puede ser que lo
        // hayamos borrado, o una cotización que ya no existe.
        if (!v) {
          throw new Error(
            `No pudimos verificar "${item.product.title}". Sacalo del carrito e intentá de nuevo.`
          );
        }

        if (!v.disponible) {
          throw new Error(
            `La cotización de "${v.title}" venció. Escribinos y te la renovamos.`
          );
        }

        if (v.stock < item.quantity) {
          throw new Error(
            `"${v.title}" solo tiene ${v.stock} unidad${v.stock === 1 ? "" : "es"} disponible${v.stock === 1 ? "" : "s"}.`
          );
        }
      }

      const priceMap = new Map(verificados.map((v) => [v.id, v.price]));

      const verifiedSubtotal = items.reduce(
        (sum, i) => sum + (porId.get(i.product.id)?.price ?? 0) * i.quantity, 0
      );

      // El envío se cobra una vez por pieza, no por unidad: es un flete, no
      // un artículo. Los productos del catálogo tienen envio_costo = 0 y
      // esto da 0, así que una compra normal no cambia en nada.
      const verifiedEnvio = items.reduce(
        (sum, i) => sum + Number(porId.get(i.product.id)?.envio_costo ?? 0), 0
      );

      const verifiedTotal = verifiedSubtotal + verifiedEnvio;

      // ── 5. Crear pedido + items via función SECURITY DEFINER ─────────────
      // Usamos RPC para esquivar restricciones RLS del cliente anónimo.
      const fullAddress = [
        sanitize(form.address, 200),
        form.neighborhood ? `Barrio: ${sanitize(form.neighborhood, 100)}` : null,
      ].filter(Boolean).join(" — ");

      /* El talle y el color viajan en el renglón del pedido. Es EL dato del
         rubro: un pedido de indumentaria sin talle obliga a llamar al cliente
         para preguntárselo, y el depósito no puede preparar nada. Además va
         escrito en el título del renglón para que aparezca sí o sí en el mail
         de confirmación, aunque la plantilla del mail no se toque. */
      const orderItems = items.map((i) => ({
        product_id: i.product.id,
        title:      [i.product.title, i.size && `Talle ${i.size}`, i.color]
                      .filter(Boolean).join(" · "),
        talle:      i.size  ?? null,
        color:      i.color ?? null,
        price:      priceMap.get(i.product.id) ?? 0,
        icon:       i.product.icon,
        image:      i.product.image ?? null,
        quantity:   i.quantity,
      }));

      // p_shipping_cost sólo se manda si hay envío que cobrar: así una
      // compra normal sigue entrando por la firma vieja de place_order
      // aunque todavía no hayas corrido el parche.
      const { data: orderData, error: orderErr } = await supabase
        .rpc("place_order", {
          p_payment_method:       payment,
          p_subtotal:             verifiedSubtotal,
          p_total:                verifiedTotal,
          ...(verifiedEnvio > 0 ? { p_shipping_cost: verifiedEnvio } : {}),
          p_shipping_name:        sanitize(form.name, 150),
          p_shipping_address:     fullAddress,
          p_shipping_city:        sanitize(form.city, 100),
          p_shipping_province:    form.province || null,
          p_shipping_postal_code: sanitize(form.zip, 20),
          p_notes: [
            form.notes ? sanitize(form.notes, 500) : null,
            `Email: ${form.email.trim().toLowerCase()}`,
            form.phone ? `Tel: ${sanitize(form.phone, 30)}` : null,
          ].filter(Boolean).join(" | "),
          p_items: orderItems,
          p_user_id: user?.id ?? null,
        });

      const order = Array.isArray(orderData) ? orderData[0] : orderData;
      if (orderErr || !order) throw new Error("No pudimos registrar el pedido. Intentá nuevamente.");

      // ── 5b. Emails de confirmación (cliente + dueños) ─────────────────────
      // Nunca debe romper el checkout si Resend falla o no está configurado.
      fetch("/api/order-confirmation", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderNumber:      order.order_number,
          customerName:     sanitize(form.name, 150),
          customerEmail:    form.email.trim().toLowerCase(),
          items:            orderItems.map((i) => ({ title: i.title, quantity: i.quantity, price: i.price })),
          subtotal:         verifiedSubtotal,
          shippingCost:     verifiedEnvio,
          total:            verifiedTotal,
          paymentMethod:    payment,
          shippingAddress:  fullAddress,
          shippingCity:     sanitize(form.city, 100),
          shippingProvince: form.province || null,
        }),
      }).catch((err) => console.error("[checkout] error al pedir email de confirmación:", err));

      // ── 6. Descontar stock (con bloqueo de fila en Supabase) ──────────────
      const stockResults = await Promise.all(
        items
          .filter((i) => i.product.id)
          .map((i) =>
            supabase.rpc("decrement_stock", { p_product_id: i.product.id, p_qty: i.quantity })
          )
      );
      const stockError = stockResults.find((r) => r.error);
      if (stockError?.error) {
        // El pedido se creó pero el stock no se pudo decrementar — notificar sin bloquear
        console.error("[checkout] decrement_stock error:", stockError.error.message);
      }

      // ── 7. Mercado Pago: el pedido ya existe (arriba), ahora hay que
      // armar la sesión de pago y mandar al cliente para allá. El estado
      // real ("se pagó" o no) lo va a definir el webhook, nunca esta
      // pantalla — por eso NO mostramos "success" acá, sólo redirigimos.
      if (payment === "mercadopago") {
        try {
          const mpRes = await fetch("/api/checkout/mercadopago", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderId: order.order_id,
              email: form.email.trim().toLowerCase(),
            }),
          });
          const mpData = await mpRes.json();
          if (!mpRes.ok || !mpData.redirectUrl) {
            throw new Error(mpData?.error || "No pudimos iniciar el pago con Mercado Pago.");
          }
          clearCart();
          window.location.href = mpData.redirectUrl;
          return; // el navegador se va a Mercado Pago
        } catch (mpErr) {
          console.error("[checkout] error al iniciar el pago con Mercado Pago:", mpErr);
          // El pedido YA se creó (arriba) — no lo escondemos: le damos el
          // número para que pueda reclamar aunque el pago no haya arrancado.
          setError(
            `Tu pedido ${order.order_number} quedó registrado, pero no pudimos iniciar el ` +
            `pago con Mercado Pago. Escribinos con ese número, o probá de nuevo.`
          );
          return;
        }
      }

      setOrderNumber(order.order_number);
      clearCart();
      setStep("success");
    } catch (err: unknown) {
      // Nunca exponer mensajes internos de DB al usuario
      const msg = err instanceof Error ? err.message : "";
      const isSafe = msg && !msg.includes("[") && !msg.includes("supabase") && !msg.includes("pg");
      setError(isSafe ? msg : "Error al procesar el pedido. Intentá nuevamente o contactanos.");
    } finally {
      setPlacing(false);
    }
  };

  /* ── PEDIDO CONFIRMADO ──────────────────────────────────────── */
  if (step === "success") {
    return (
      <main className="min-h-screen bg-ink">
        <div className="ag-rail" aria-hidden="true" />
        <div className="mx-auto flex min-h-[calc(100vh-3px)] max-w-2xl flex-col justify-center px-5 py-14">

          <div className="ag-rise ag-d1">
            <div className="ag-tick mb-6" aria-hidden="true"><i /><i /><i /></div>
            <p className="ag-eyebrow mb-3">Pedido recibido</p>
            <h1 className="font-display text-[clamp(2.2rem,6vw,3.4rem)] font-extrabold uppercase leading-none">
              Gracias por<br />tu compra
            </h1>
            <p className="ag-mono mt-6 text-[1.15rem] font-medium tracking-[0.06em] text-acentohi">
              {orderNumber}
            </p>
          </div>

          <div className="ag-rise ag-d2 mt-9 border border-line bg-panel">
            <div className="p-6 md:p-8">
              <p className="ag-eyebrow mb-4">Qué sigue</p>

              {payment === "transferencia" && (
                <>
                  <p className="font-light leading-relaxed text-mute">
                    Hacé la transferencia y mandanos el comprobante por WhatsApp o por email.
                    Apenas lo confirmamos, preparamos el pedido y lo despachamos.
                  </p>
                  <div className="mt-6 border border-acento/30 bg-ink p-5">
                    <p className="ag-label mb-3">Datos para transferir</p>
                    <p className="ag-mono text-[1.05rem] font-medium tracking-[0.08em] text-acentohi">
                      ALIAS: ARG.INDUMENTARIA
                    </p>
                    <p className="ag-mono mt-2 text-mute">CBU: 0000 0000 0000 0000 0000 00</p>
                    <p className="ag-mono mt-1 text-mute">Banco: — completar —</p>
                  </div>
                </>
              )}

              {payment === "efectivo" && (
                <p className="font-light leading-relaxed text-mute">
                  Te escribimos para coordinar el punto de entrega y el pago en efectivo.
                  Tené el pedido a mano por si hay que revisar alguna referencia.
                </p>
              )}

              <div className="mt-6 border-t border-line pt-5">
                <p className="text-[0.9rem] font-light text-dim">
                  Te mandamos la confirmación a{" "}
                  <span className="text-chalk">{form.email}</span>
                </p>
              </div>
            </div>
          </div>

          <div className="ag-rise ag-d3 mt-8 flex flex-wrap gap-3">
            <button onClick={() => router.push("/")} className="ag-btn ag-btn-solid">
              Volver a la tienda <Icon name="arrow" size={18} />
            </button>
            <button onClick={() => router.push("/mi-cuenta")} className="ag-btn ag-btn-ghost">
              Ver mis compras
            </button>
          </div>
        </div>
      </main>
    );
  }

  /* ── FORMULARIO ─────────────────────────────────────────────── */

  // El flete de las piezas a pedido, para mostrarlo discriminado. Se cobra
  // una vez por producto, no por unidad. Todo el catálogo tiene envio_costo 0,
  // así que en una compra normal esto vale 0 y la pantalla no cambia.
  const envioCarrito = items.reduce((s, i) => s + Number(i.product.envio_costo ?? 0), 0);
  const totalConEnvio = totalPrice + envioCarrito;

  const resumen = (
    <>
      <div className="flex items-center justify-between border-b border-line px-6 py-5">
        <h2 className="font-display text-[1.05rem] font-extrabold uppercase tracking-[-0.02em]">
          Tu pedido
        </h2>
        <span className="ag-label">
          {items.length} {items.length === 1 ? "artículo" : "artículos"}
        </span>
      </div>

      <div className="custom-scrollbar max-h-[42vh] space-y-2.5 overflow-y-auto px-6 py-5">
        {items.map(({ product, quantity, size, color, lineId }) => (
          <div key={lineId} className="border border-line bg-panel p-3.5">
            <div className="flex gap-3">
              <div
                className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden border border-line"
                style={{ background: "radial-gradient(70% 70% at 50% 42%, #1D2229 0%, #0F1216 78%)" }}
              >
                {product.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={product.image} alt="" className="h-full w-full object-contain p-1" />
                ) : (
                  <span className="w-[60%] text-[#5A626E]">
                    <Icon name={productIcon(product)} size="100%" />
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                {product.brand && (
                  <p className="font-cond text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-mute">
                    {product.brand}
                  </p>
                )}
                <p className="line-clamp-2 font-display text-[0.88rem] font-bold leading-tight">
                  {product.title}
                </p>
                {(size || color) && (
                  <p className="mt-1 font-cond text-[0.76rem] uppercase tracking-[0.12em] text-mute">
                    {[size && `Talle ${size}`, color].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>

              <button
                onClick={() => removeItem(lineId)}
                aria-label={`Quitar ${product.title}`}
                className="h-fit shrink-0 text-dim transition-colors hover:text-sale"
              >
                <Icon name="close" size={14} />
              </button>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => decrement(lineId)}
                  aria-label="Quitar una unidad"
                  className="grid h-7 w-7 place-items-center border border-line text-mute transition-colors hover:border-linehi hover:text-chalk"
                >
                  −
                </button>
                <span className="ag-num w-6 text-center font-display text-[0.9rem] font-bold">{quantity}</span>
                <button
                  onClick={() => increment(lineId)}
                  aria-label="Agregar una unidad"
                  className="grid h-7 w-7 place-items-center border border-line text-mute transition-colors hover:border-linehi hover:text-chalk"
                >
                  +
                </button>
              </div>
              <span className="ag-num font-display text-[0.98rem] font-extrabold tracking-[-0.03em]">
                {money(product.price * quantity)}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-line px-6 py-5">
        <div className="flex justify-between py-1">
          <span className="ag-label">Subtotal</span>
          <span className="ag-num text-mute">{money(totalPrice)}</span>
        </div>
        <div className="flex justify-between py-1">
          <span className="ag-label">Envío</span>
          {envioCarrito > 0
            ? <span className="ag-num text-mute">{money(envioCarrito)}</span>
            : <span className="ag-label">A coordinar</span>}
        </div>
        <div className="mt-3 flex items-baseline justify-between border-t border-line pt-4">
          <span className="ag-eyebrow text-chalk">Total</span>
          <span className="ag-num font-display text-[1.6rem] font-extrabold tracking-[-0.035em] text-acentohi">
            {money(totalConEnvio)}
          </span>
        </div>

        {error && (
          <div className="mt-5 border border-sale/40 bg-sale/10 px-4 py-3">
            <p className="text-[0.88rem] font-light leading-relaxed text-sale">{error}</p>
          </div>
        )}

        <button
          onClick={placeOrder}
          disabled={!fieldValid || placing}
          className="ag-btn ag-btn-acento mt-5 w-full"
        >
          {placing
            ? "Procesando…"
            : payment === "mercadopago"
              ? "Ir a pagar con Mercado Pago"
              : "Confirmar pedido"}
          {!placing && <Icon name="arrow" size={18} />}
        </button>

        {!fieldValid && !placing && (
          <p className="mt-3 text-center text-[0.82rem] font-light text-dim">
            Completá los campos marcados y elegí cómo vas a pagar.
          </p>
        )}
      </div>
    </>
  );

  return (
    <main className="min-h-screen bg-ink pb-40 lg:pb-0">
      <div className="ag-rail" aria-hidden="true" />

      {/* Encabezado */}
      <header className="border-b border-line bg-[#0b0d10]">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-5 py-4 md:px-10">
          <button
            onClick={() => router.back()}
            className="font-cond text-[0.85rem] font-semibold uppercase tracking-[0.16em] text-dim transition-colors hover:text-chalk"
          >
            ← Volver
          </button>
          <Brand size="sm" />
          <div className="hidden w-24 md:block" />
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] px-5 py-8 md:px-10 md:py-12">
        <div className="mb-8 md:mb-11">
          <div className="ag-tick mb-4" aria-hidden="true"><i /><i /><i /></div>
          <p className="ag-eyebrow mb-2.5">Último paso</p>
          <h1 className="font-display text-[clamp(1.9rem,4.5vw,3rem)] font-extrabold uppercase leading-none">
            Finalizar compra
          </h1>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_400px] lg:gap-8">

          <div className="space-y-6">

            {!userLoading && !user && (
              <div className="border border-warn/30 bg-warn/5 px-5 py-4">
                <p className="ag-eyebrow mb-1.5 text-warn">Estás comprando como invitado</p>
                <p className="text-[0.9rem] font-light leading-relaxed text-mute">
                  Podés terminar la compra igual. Con cuenta te queda el historial de pedidos
                  y no tenés que volver a cargar la dirección.
                </p>
              </div>
            )}

            <Paso n="01" titulo="Datos de envío">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Campo label="Nombre completo" req span>
                  <input type="text" value={form.name} onChange={set("name")} required className="ag-input" />
                </Campo>

                <Campo label="Email" req hint="Ahí te mandamos la confirmación">
                  <input type="email" value={form.email} onChange={set("email")} required className="ag-input" />
                </Campo>

                <Campo label="Teléfono / WhatsApp" hint="Para coordinar la entrega">
                  <input type="tel" value={form.phone} onChange={set("phone")} className="ag-input" />
                </Campo>

                <Campo label="Dirección" req span>
                  <input
                    type="text" value={form.address} onChange={set("address")} required
                    placeholder="Calle, número, piso y depto" className="ag-input"
                  />
                </Campo>

                <Campo label="Barrio" span>
                  <input
                    type="text" value={form.neighborhood} onChange={set("neighborhood")}
                    placeholder="Ej: Nueva Córdoba, Villa Crespo" className="ag-input"
                  />
                </Campo>

                <Campo label="Ciudad" req>
                  <input type="text" value={form.city} onChange={set("city")} required className="ag-input" />
                </Campo>

                <Campo label="Provincia">
                  <select value={form.province} onChange={set("province")} className="ag-input cursor-pointer">
                    <option value="">— Seleccioná —</option>
                    {PROVINCIAS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </Campo>

                <Campo label="Código postal">
                  <input type="text" value={form.zip} onChange={set("zip")} className="ag-input" />
                </Campo>

                <Campo label="Notas del pedido" span>
                  <textarea
                    value={form.notes} onChange={set("notes")} rows={3}
                    placeholder="Horarios de entrega, referencias, un talle alternativo por si no hay stock…"
                    className="ag-input resize-none"
                  />
                </Campo>
              </div>
            </Paso>

            <Paso n="02" titulo="Cómo pagás">
              <div className="space-y-2.5">
                {([
                  {
                    id: "transferencia" as const,
                    titulo: "Transferencia bancaria",
                    detalle: "Te pasamos alias y CBU. Confirmamos apenas llega el comprobante.",
                  },
                  {
                    id: "efectivo" as const,
                    titulo: "Efectivo",
                    detalle: "Coordinamos la entrega y pagás al recibir.",
                  },
                  {
                    id: "mercadopago" as const,
                    titulo: "Mercado Pago",
                    detalle: "Tarjeta, débito o dinero en cuenta. Te llevamos a Mercado Pago para pagar.",
                  },
                ]).map((op) => {
                  const activo = payment === op.id;
                  return (
                    <label
                      key={op.id}
                      className={`flex cursor-pointer items-start gap-4 border p-5 transition-colors ${
                        activo ? "border-acento bg-acento/5" : "border-line hover:border-linehi"
                      }`}
                    >
                      <input
                        type="radio" name="payment" value={op.id}
                        checked={activo} onChange={() => setPayment(op.id)}
                        className="mt-0.5 h-[18px] w-[18px] shrink-0 appearance-none rounded-full border-2 border-linehi bg-transparent transition-colors checked:border-acento checked:bg-acento"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-display text-[0.98rem] font-extrabold uppercase leading-tight">
                          {op.titulo}
                        </p>
                        <p className="mt-1.5 text-[0.88rem] font-light leading-relaxed text-mute">
                          {op.detalle}
                        </p>
                      </div>
                      {activo && (
                        <span className="shrink-0 text-acentohi"><Icon name="check" size={18} /></span>
                      )}
                    </label>
                  );
                })}

              </div>
            </Paso>
          </div>

          {/* Resumen — escritorio */}
          <aside className="hidden lg:block">
            <div className="sticky top-6 border border-line bg-panel">{resumen}</div>
          </aside>

          {/* Resumen — móvil, arriba de la barra fija */}
          <div className="border border-line bg-panel lg:hidden">{resumen}</div>
        </div>
      </div>

      {/* Barra fija en móvil */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-line bg-[#0b0d10]/95 px-5 py-3.5 backdrop-blur-md lg:hidden">
        <div className="mb-2.5 flex items-baseline justify-between">
          <div>
            <p className="ag-label">
              {items.length} {items.length === 1 ? "artículo" : "artículos"}
              {envioCarrito > 0 ? ` · envío ${money(envioCarrito)}` : " · envío a coordinar"}
            </p>
            <p className="ag-num font-display text-[1.5rem] font-extrabold leading-tight tracking-[-0.035em] text-acentohi">
              {money(totalConEnvio)}
            </p>
          </div>
        </div>
        {error && (
          <p className="mb-2 text-center text-[0.82rem] font-light text-sale">{error}</p>
        )}
        <button
          onClick={placeOrder}
          disabled={!fieldValid || placing}
          className="ag-btn ag-btn-acento ag-btn-sm w-full"
        >
          {placing
            ? "Procesando…"
            : payment === "mercadopago"
              ? "Ir a pagar con Mercado Pago"
              : "Confirmar pedido"}
        </button>
        {!fieldValid && !placing && (
          <p className="mt-2 text-center text-[0.78rem] font-light text-dim">
            Completá los campos marcados y elegí cómo vas a pagar.
          </p>
        )}
      </div>
    </main>
  );
}

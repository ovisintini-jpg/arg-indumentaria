// src/app/pedido-especial/_pieza-view.tsx
//
// Lo que ve el cliente cuando abre el link de su cotización. La fila está
// escondida por RLS, así que no se puede leer con un SELECT normal: entra por
// get_pieza_por_token(), que es SECURITY DEFINER y sólo devuelve la pieza si
// el token coincide y la cotización no venció.

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase, supabaseConfigurado } from "@/lib/supabase";
import { useCart } from "@/context/CartContext";
import { Product } from "@/types";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const money = (n: number) => `$${n.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "long" });

interface FilaPieza {
  id: string; title: string; price: number; envio_costo: number;
  icon: string; image: string | null; images: string[] | null;
  category_id: string; subcategory: string | null;
  brand: string | null; sku: string | null;
  description: string | null; detalle: string | null;
  stock: number;
  cliente_nombre: string | null; cliente_email: string | null;
  vence_el: string | null;
}

type Estado = "cargando" | "ok" | "no-existe";

export default function PiezaView({ token }: { token: string }) {
  const router = useRouter();
  const { addItem } = useCart();

  const [estado, setEstado] = useState<Estado>("cargando");
  const [pieza,  setPieza]  = useState<FilaPieza | null>(null);
  const [foto,   setFoto]   = useState(0);

  useEffect(() => {
    if (!supabaseConfigurado) { setEstado("no-existe"); return; }

    supabase
      .rpc("get_pieza_por_token", { p_token: token })
      .then(({ data, error }) => {
        const fila = Array.isArray(data) ? data[0] : data;
        if (error || !fila) { setEstado("no-existe"); return; }
        setPieza(fila as FilaPieza);
        setEstado("ok");
      });
  }, [token]);

  /* ── Todavía cargando ───────────────────────────────────────── */
  if (estado === "cargando") {
    return (
      <Marco>
        <p className="ag-label">Buscando tu cotización…</p>
      </Marco>
    );
  }

  /* ── Token que no existe, o cotización vencida ──────────────── */
  // No distinguimos entre los dos casos a propósito: la respuesta no tiene
  // que decir si un token existe o no.
  if (estado === "no-existe" || !pieza) {
    return (
      <Marco>
        <p className="ag-eyebrow mb-3">Cotización</p>
        <h1 className="font-display text-[clamp(1.6rem,4vw,2.4rem)] font-extrabold uppercase leading-none">
          No encontramos esta cotización
        </h1>
        <p className="mt-5 max-w-[46ch] font-light leading-relaxed text-mute">
          El link puede haber vencido, o estar incompleto. Si te lo pasamos hace poco,
          escribinos y te lo renovamos en el momento.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/" className="ag-btn ag-btn-acento">Ir a la tienda</Link>
        </div>
      </Marco>
    );
  }

  /* ── La cotización ──────────────────────────────────────────── */
  const fotos  = [...(pieza.image ? [pieza.image] : []), ...(pieza.images ?? [])];
  const envio  = Number(pieza.envio_costo ?? 0);
  const precio = Number(pieza.price);
  const total  = precio + envio;

  const comprar = () => {
    // Es una fila real de products, así que entra al carrito como cualquier
    // otro repuesto y sale por el checkout de siempre.
    const producto: Product = {
      id:          pieza.id,
      title:       pieza.title,
      price:       precio,
      envio_costo: envio,
      icon:        pieza.icon ?? "🔧",
      image:       pieza.image ?? undefined,
      images:      pieza.images ?? undefined,
      categoryId:  pieza.category_id,
      subcategory: pieza.subcategory ?? undefined,
      brand:       pieza.brand ?? undefined,
      sku:         pieza.sku ?? undefined,
      description: pieza.description ?? undefined,
      stock:       pieza.stock ?? 1,
      visibilidad: "privado",
    };
    addItem(producto);
    router.push("/checkout");
  };

  return (
    <div className="flex min-h-screen flex-col bg-ink text-chalk">
      <Header />

      <main className="flex-1">
        <div className="mx-auto w-full max-w-[1100px] px-6 py-12 lg:px-10 lg:py-16">

          <div className="ag-tick mb-4" aria-hidden="true"><i /><i /><i /></div>
          <p className="ag-eyebrow mb-2">
            {pieza.cliente_nombre ? `Cotización para ${pieza.cliente_nombre}` : "Tu cotización"}
          </p>

          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-14">

            {/* Fotos */}
            <div>
              <div className="flex aspect-square w-full items-center justify-center overflow-hidden border border-line bg-panel">
                {fotos.length > 0 ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={fotos[foto]} alt={pieza.title} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-[5rem] leading-none">{pieza.icon ?? "🔧"}</span>
                )}
              </div>

              {fotos.length > 1 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {fotos.map((url, i) => (
                    <button
                      key={url}
                      onClick={() => setFoto(i)}
                      aria-label={`Ver foto ${i + 1}`}
                      className={`h-16 w-16 overflow-hidden border transition-colors ${
                        i === foto ? "border-acento" : "border-line hover:border-linehi"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Datos y precio */}
            <div>
              <h1 className="font-display text-[clamp(1.6rem,3.4vw,2.4rem)] font-extrabold uppercase leading-[0.95]">
                {pieza.title}
              </h1>

              {(pieza.brand || pieza.sku) && (
                <p className="ag-label mt-4">
                  {[pieza.brand, pieza.sku ? `SKU ${pieza.sku}` : null].filter(Boolean).join(" · ")}
                </p>
              )}

              {pieza.description && (
                <p className="mt-5 max-w-[48ch] font-light leading-relaxed text-mute">
                  {pieza.description}
                </p>
              )}

              {/* El precio, discriminado. No es cosmético: la Ley 24.240 pide
                  que el precio final y sus componentes estén a la vista. */}
              <div className="mt-8 border border-line bg-panel">
                <div className="px-6 py-5">
                  <div className="flex justify-between py-1">
                    <span className="ag-label">Pieza</span>
                    <span className="ag-num text-mute">{money(precio)}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="ag-label">Envío</span>
                    <span className="ag-num text-mute">
                      {envio > 0 ? money(envio) : "A coordinar"}
                    </span>
                  </div>
                  <div className="mt-3 flex items-baseline justify-between border-t border-line pt-4">
                    <span className="ag-eyebrow text-chalk">Total</span>
                    <span className="ag-num font-display text-[1.8rem] font-extrabold tracking-[-0.035em] text-acentohi">
                      {money(total)}
                    </span>
                  </div>
                </div>
              </div>

              {pieza.detalle && (
                <div className="mt-6 border-l-2 border-acento bg-acento/5 px-5 py-4">
                  <p className="whitespace-pre-line font-light leading-relaxed text-chalk">
                    {pieza.detalle}
                  </p>
                </div>
              )}

              <button onClick={comprar} className="ag-btn ag-btn-acento mt-8 w-full">
                Agregar al carrito y pagar
              </button>

              <p className="ag-label mt-4 normal-case tracking-[0.08em]">
                {pieza.vence_el
                  ? `Esta cotización vale hasta el ${fecha(pieza.vence_el)}.`
                  : "Esta cotización no tiene fecha de vencimiento."}
                {" "}Es tuya: no está publicada en la tienda.
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

/** El marco sobrio de los estados que no son una cotización. */
function Marco({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-ink text-chalk">
      <Header />
      <main className="flex flex-1 items-center">
        <div className="mx-auto w-full max-w-[1100px] px-6 py-24 lg:px-10">{children}</div>
      </main>
      <Footer />
    </div>
  );
}

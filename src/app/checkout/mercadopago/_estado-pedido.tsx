// src/app/checkout/mercadopago/_estado-pedido.tsx
//
// Página compartida por las tres rutas de retorno de Mercado Pago
// (exito/pendiente/error). Regla del brief: "no confiar en el redirect de
// vuelta al sitio para dar el pedido por pagado" — por eso esto NO se
// conforma con "a qué página te mandó Mercado Pago": además consulta
// get_order_status_public() para mostrar el estado REAL del pedido, que es
// el que define el webhook (src/app/api/webhooks/mercadopago/route.ts).
// Es sólo un mensaje al cliente: no cambia nada en la base.

"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Brand from "@/components/Brand";
import { Icon } from "@/components/Icons";

type Intent = "exito" | "pendiente" | "error";
type EstadoReal = "cargando" | "paid" | "pending" | "failed" | "desconocido";

const COPY: Record<Intent, { eyebrow: string; titulo: string; bajada: string }> = {
  exito: {
    eyebrow: "Pago con Mercado Pago",
    titulo: "¡Gracias por tu compra!",
    bajada: "Mercado Pago nos avisó que tu pago se aprobó.",
  },
  pendiente: {
    eyebrow: "Pago con Mercado Pago",
    titulo: "Tu pago está pendiente",
    bajada:
      "Mercado Pago todavía lo está procesando — pasa seguido con Rapipago, Pago Fácil o transferencia dentro de la app.",
  },
  error: {
    eyebrow: "Pago con Mercado Pago",
    titulo: "No pudimos procesar el pago",
    bajada: "El pago no se completó. Podés volver a intentarlo desde tu carrito.",
  },
};

export default function EstadoPedido({ intent }: { intent: Intent }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const numero = searchParams.get("pedido") ?? "";

  const [estadoReal, setEstadoReal] = useState<EstadoReal>("cargando");

  useEffect(() => {
    if (!numero) {
      setEstadoReal("desconocido");
      return;
    }
    let cancelado = false;

    supabase
      .rpc("get_order_status_public", { p_order_number: numero })
      .single()
      .then(({ data, error }) => {
        if (cancelado) return;
        if (error || !data) {
          setEstadoReal("desconocido");
          return;
        }
        const ps = (data as { payment_status?: string }).payment_status;
        setEstadoReal(ps === "paid" || ps === "pending" || ps === "failed" ? ps : "desconocido");
      });

    return () => {
      cancelado = true;
    };
  }, [numero]);

  const copy = COPY[intent];

  return (
    <main className="min-h-screen bg-ink">
      <div className="ag-rail" aria-hidden="true" />
      <div className="mx-auto flex min-h-[calc(100vh-3px)] max-w-2xl flex-col justify-center px-5 py-14">
        <div className="ag-rise ag-d1">
          <Brand size="sm" />
          <div className="ag-tick my-6" aria-hidden="true">
            <i /><i /><i />
          </div>
          <p className="ag-eyebrow mb-3">{copy.eyebrow}</p>
          <h1 className="font-display text-[clamp(2rem,5vw,3rem)] font-extrabold uppercase leading-none">
            {copy.titulo}
          </h1>
          <p className="mt-4 font-light leading-relaxed text-mute">{copy.bajada}</p>
          {numero && (
            <p className="ag-mono mt-6 text-[1.05rem] font-medium tracking-[0.06em] text-acentohi">
              {numero}
            </p>
          )}
        </div>

        <div className="ag-rise ag-d2 mt-9 border border-line bg-panel p-6 md:p-8">
          <p className="ag-eyebrow mb-3">Estado real del pedido</p>
          {estadoReal === "cargando" && <p className="font-light text-dim">Consultando…</p>}
          {estadoReal === "paid" && (
            <p className="font-light text-ok">Confirmado: el pago se acreditó.</p>
          )}
          {estadoReal === "pending" && (
            <p className="font-light text-warn">
              Todavía no se acreditó. Puede tardar unos minutos — te avisamos por mail apenas
              se confirme.
            </p>
          )}
          {estadoReal === "failed" && (
            <p className="font-light text-sale">El pago no se acreditó.</p>
          )}
          {estadoReal === "desconocido" && (
            <p className="font-light text-dim">
              No pudimos confirmar el estado desde acá. Si te cobraron y esto no se actualiza,
              escribinos con el número de pedido.
            </p>
          )}
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

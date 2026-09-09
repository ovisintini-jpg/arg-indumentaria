// components/Resenas.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase, supabaseConfigurado } from "@/lib/supabase";
import SectionHead from "@/components/SectionHead";
import { Icon } from "@/components/Icons";
import { useQuote } from "@/context/QuoteContext";

interface Resena {
  id:            string;
  customer_name: string;
  stars:         number;
  body:          string;
}

/* ────────────────────────────────────────────────────────────────
   EJEMPLOS DE DISEÑO — NO SON RESEÑAS DE CLIENTES

   Sirven para ver cómo se van a ver las tarjetas mientras todavía
   no hay reseñas reales cargadas. Sólo aparecen cuando el sitio
   corre en tu máquina con `npm run dev`: en el sitio publicado
   (Vercel) nunca se muestran, porque inventar testimonios de
   clientes es publicidad engañosa y en este rubro la confianza es
   justamente lo que se vende.

   En producción, si no hay reseñas verificadas, se muestra el
   bloque de abajo ("Todavía no hay reseñas publicadas"), que llena
   el espacio sin mentir.
   ──────────────────────────────────────────────────────────────── */
const EJEMPLOS: Resena[] = [
  {
    id: "ej-1",
    customer_name: "Nombre del cliente",
    stars: 5,
    body: "Acá va el texto que deja el cliente después de recibir el pedido. Se escribe solo desde Mi cuenta y vos lo aprobás en Admin → Reseñas antes de que salga publicado.",
  },
  {
    id: "ej-2",
    customer_name: "Nombre del cliente",
    stars: 5,
    body: "Cada tarjeta muestra el nombre, las estrellas y el comentario. El pedido tiene que estar entregado para que la persona pueda escribir.",
  },
  {
    id: "ej-3",
    customer_name: "Nombre del cliente",
    stars: 4,
    body: "Se muestran hasta seis reseñas, de la más nueva a la más vieja. Las que bloquees en el panel no aparecen nunca.",
  },
];

const ES_DEV = process.env.NODE_ENV === "development";

function Estrellas({ n }: { n: number }) {
  return (
    <div className="flex gap-1" aria-label={`${n} de 5 estrellas`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
          className={`h-4 w-4 ${i < n ? "text-acentohi" : "text-line"}`}
        >
          <path d="M9.05 2.93c.3-.92 1.6-.92 1.9 0l1.07 3.29a1 1 0 0 0 .95.69h3.46c.97 0 1.37 1.24.59 1.81l-2.8 2.03a1 1 0 0 0-.37 1.12l1.07 3.29c.3.92-.75 1.69-1.54 1.12l-2.8-2.04a1 1 0 0 0-1.17 0l-2.8 2.04c-.79.57-1.84-.2-1.54-1.12l1.07-3.29a1 1 0 0 0-.37-1.12L2.98 8.72c-.78-.57-.38-1.81.59-1.81h3.46a1 1 0 0 0 .95-.69L9.05 2.93Z" />
        </svg>
      ))}
    </div>
  );
}

function Tarjeta({ r }: { r: Resena }) {
  return (
    <li className="flex flex-col border border-line bg-ink p-5 md:p-7">
      <Estrellas n={r.stars} />
      <p className="mt-4 flex-1 text-[0.95rem] font-light leading-relaxed text-chalk md:mt-5 md:text-[0.98rem]">
        “{r.body}”
      </p>
      <div className="mt-5 border-t border-line pt-4">
        <p className="font-display text-[0.92rem] font-extrabold uppercase tracking-[0.02em]">
          {r.customer_name}
        </p>
        <p className="ag-mono mt-1 text-[0.72rem] uppercase tracking-[0.12em] text-dim">
          Compra verificada
        </p>
      </div>
    </li>
  );
}

/* Lo que se ve cuando todavía no hay ninguna reseña publicada.
   Todo lo que dice acá es cierto hoy, así que puede salir al aire. */
function SinResenas() {
  const { abrirCotizador } = useQuote();

  return (
    <div className="border border-line bg-ink px-5 py-8 md:px-12 md:py-14">
      <div className="grid gap-8 md:grid-cols-[1.1fr_1fr] md:gap-16">
        <div>
          <h3 className="font-display text-[clamp(1.25rem,2.2vw,1.7rem)] font-extrabold leading-tight">
            Todavía no hay reseñas publicadas
          </h3>
          <p className="mt-4 max-w-[46ch] text-[0.98rem] font-light leading-relaxed text-mute">
            Somos nuevos y preferimos decirlo. Acá sólo van a aparecer comentarios de gente
            que compró de verdad: el sistema deja escribir una reseña únicamente cuando el
            pedido figura entregado. Ni una inventada.
          </p>
          <button
            type="button"
            onClick={() => abrirCotizador()}
            className="ag-btn ag-btn-acento ag-btn-sm mt-7"
          >
            Pedilo por encargo <Icon name="arrow" size={16} />
          </button>
        </div>

        <ul className="grid gap-px bg-line">
          {[
            {
              t: "Las medidas reales, en la ficha",
              p: "Cada prenda con su tabla de talles y su composición, para que elijas antes de pagar.",
            },
            {
              t: "Precio y plazo cerrados",
              p: "Te los pasamos por escrito antes de la compra. Si no te sirve, no seguís.",
            },
            {
              t: "Lo que no está en el catálogo, lo buscamos",
              p: "Decinos qué prenda, en qué talle y en qué color, y te decimos si lo conseguimos.",
            },
          ].map((f) => (
            <li key={f.t} className="bg-ink py-5 first:pt-0">
              <div className="flex gap-3">
                <span className="mt-0.5 shrink-0 text-acentohi">
                  <Icon name="check" size={18} />
                </span>
                <div>
                  <p className="font-display text-[0.98rem] font-extrabold">{f.t}</p>
                  <p className="mt-1.5 text-[0.9rem] font-light leading-relaxed text-mute">
                    {f.p}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function Resenas() {
  const [resenas, setResenas] = useState<Resena[]>([]);
  const [cargando, setCargando] = useState(supabaseConfigurado);

  useEffect(() => {
    if (!supabaseConfigurado) return;
    let activo = true;

    (async () => {
      const { data } = await supabase
        .from("reviews")
        .select("id, customer_name, stars, body")
        .eq("status", "verified")
        .order("created_at", { ascending: false })
        .limit(6);

      if (!activo) return;
      if (data) setResenas(data as Resena[]);
      setCargando(false);
    })();

    return () => { activo = false; };
  }, []);

  // Mientras consulta no dibuja nada, para que no parpadee el bloque vacío.
  if (cargando) return null;

  const hayReales = resenas.length > 0;
  const aMostrar  = hayReales ? resenas : ES_DEV ? EJEMPLOS : [];

  return (
    <section id="resenas" className="border-b border-line bg-panel">
      <div className="mx-auto w-full max-w-[1320px] px-4 py-11 md:px-6 md:py-24 lg:px-14">
        <SectionHead
          eyebrow="Lo que dicen los que compraron"
          title={hayReales ? "Reseñas de clientes" : "Reseñas verificadas"}
        />

        {!hayReales && ES_DEV && (
          <p className="ag-mono mb-6 inline-block border border-warn/50 bg-warn/10 px-3 py-2 text-[0.72rem] uppercase tracking-[0.12em] text-warn">
            Vista de ejemplo — sólo en tu máquina. En el sitio publicado se ve el bloque de abajo.
          </p>
        )}

        {aMostrar.length > 0 ? (
          <ul className="grid gap-4 md:grid-cols-3 md:gap-6">
            {aMostrar.map((r) => <Tarjeta key={r.id} r={r} />)}
          </ul>
        ) : (
          <SinResenas />
        )}

        {!hayReales && ES_DEV && (
          <div className="mt-10">
            <p className="ag-mono mb-6 inline-block border border-line px-3 py-2 text-[0.72rem] uppercase tracking-[0.12em] text-dim">
              Así se ve en el sitio publicado mientras no haya reseñas
            </p>
            <SinResenas />
          </div>
        )}
      </div>
    </section>
  );
}

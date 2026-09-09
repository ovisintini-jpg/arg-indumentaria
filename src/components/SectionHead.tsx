// components/SectionHead.tsx
import React from "react";

/* El encabezado de sección. Volanta chica, título grande y, si hace falta, una
   bajada al costado. Sin la marca de tres barras que llevaba la versión de
   autopartes: en una página clara y con fotos grandes, ese adorno arriba de
   cada título sumaba ruido y no información. */
export default function SectionHead({
  eyebrow,
  title,
  sub,
  action,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-5 md:mb-10 md:gap-8">
      <div>
        <p className="ag-eyebrow mb-2.5">{eyebrow}</p>
        <h2 className="ag-title max-w-[20ch] font-display text-[clamp(1.6rem,3.6vw,2.8rem)] font-extrabold">
          {title}
        </h2>
      </div>
      {sub && <p className="max-w-[42ch] text-[0.95rem] text-mute">{sub}</p>}
      {action}
    </div>
  );
}

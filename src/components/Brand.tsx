// components/Brand.tsx
import React from "react";

/* El logotipo. Dos palabras y una marca de tres barras inclinadas.
   "ARG" va en negra y "INDUMENTARIA" en un peso menor y con más aire entre
   letras: así el ojo agarra primero la marca corta y después el rubro, que es
   como funciona cualquier logotipo de dos palabras (Nordstrom Rack, Rack Room
   Shoes). En el celular baja un escalón para que la fila del header no se
   desborde: medido en 375, 390 y 412 px. */
export default function Brand({
  size = "md",
  className = "",
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const type =
    size === "lg" ? "text-[1.7rem]" : size === "sm" ? "text-[0.95rem]" : "text-[1.05rem] md:text-[1.3rem]";
  const bar =
    size === "lg" ? "h-6 w-3.5" : size === "sm" ? "h-3.5 w-2.5" : "h-[14px] w-2.5 md:h-[18px] md:w-3";
  const sub =
    size === "lg" ? "text-[0.78rem]" : size === "sm" ? "text-[0.5rem]" : "text-[0.55rem] md:text-[0.66rem]";

  return (
    <span
      className={`flex items-center whitespace-nowrap font-display uppercase ${type} ${className}`}
    >
      <span className={`ag-slash mr-2.5 ${bar}`} aria-hidden="true">
        <i /><i /><i />
      </span>
      <b className="font-black tracking-[-0.04em]">ARG</b>
      <span className={`ml-2 font-semibold tracking-[0.26em] text-mute ${sub}`}>
        Indumentaria
      </span>
    </span>
  );
}

"use client";

import { useState } from "react";
import SectionHead from "@/components/SectionHead";

/* ───────────────────────────────────────────────────────────────────────────
   GUÍA DE TALLES

   La devolución por talle equivocado es el costo más grande de una tienda de
   ropa por internet, y la mitad de esas devoluciones se evitan con una tabla
   de medidas a la vista. Por eso esto no está escondido en una página de
   ayuda: está en la home y, además, se puede abrir desde cada ficha.

   Las medidas son en centímetros y sobre el CUERPO, no sobre la prenda. Es lo
   que entiende cualquiera con un centímetro de costura en la mano. Ajustá los
   números a los de tu proveedor: los de acá son la escala argentina estándar.
   ─────────────────────────────────────────────────────────────────────────── */

type Tabla = { columnas: string[]; filas: string[][] };

const TABLAS: Record<string, Tabla> = {
  "Mujer": {
    columnas: ["Talle", "Argentino", "Busto (cm)", "Cintura (cm)", "Cadera (cm)"],
    filas: [
      ["XS", "36", "82 – 85", "62 – 65", "88 – 91"],
      ["S",  "38", "86 – 89", "66 – 69", "92 – 95"],
      ["M",  "40", "90 – 94", "70 – 74", "96 – 100"],
      ["L",  "42", "95 – 99", "75 – 79", "101 – 105"],
      ["XL", "44", "100 – 105", "80 – 85", "106 – 111"],
      ["XXL","46", "106 – 112", "86 – 92", "112 – 118"],
    ],
  },
  "Hombre": {
    columnas: ["Talle", "Argentino", "Pecho (cm)", "Cintura (cm)", "Cadera (cm)"],
    filas: [
      ["S",  "38", "88 – 93", "76 – 81", "90 – 95"],
      ["M",  "40", "94 – 99", "82 – 87", "96 – 101"],
      ["L",  "42", "100 – 105", "88 – 93", "102 – 107"],
      ["XL", "44", "106 – 111", "94 – 99", "108 – 113"],
      ["XXL","46", "112 – 118", "100 – 106", "114 – 120"],
    ],
  },
  "Calzado": {
    columnas: ["ARG", "EUR", "USA mujer", "USA hombre", "Largo del pie (cm)"],
    filas: [
      ["35", "36", "5",  "—",  "22,5"],
      ["36", "37", "6",  "—",  "23,3"],
      ["37", "38", "7",  "5",  "24,1"],
      ["38", "39", "8",  "6",  "24,8"],
      ["39", "40", "9",  "7",  "25,4"],
      ["40", "41", "10", "8",  "26,0"],
      ["41", "42", "11", "9",  "26,7"],
      ["42", "43", "—",  "10", "27,3"],
      ["43", "44", "—",  "11", "28,0"],
      ["44", "45", "—",  "12", "28,6"],
    ],
  },
  "Niños": {
    columnas: ["Talle", "Edad", "Altura (cm)", "Pecho (cm)"],
    filas: [
      ["2",  "2 años",   "88 – 94",   "53 – 55"],
      ["4",  "4 años",   "99 – 107",  "56 – 58"],
      ["6",  "6 años",   "112 – 119", "59 – 62"],
      ["8",  "8 años",   "124 – 130", "63 – 66"],
      ["10", "10 años",  "134 – 140", "67 – 71"],
      ["12", "12 años",  "144 – 150", "72 – 76"],
      ["14", "14 años",  "154 – 160", "77 – 82"],
      ["16", "16 años",  "162 – 168", "83 – 88"],
    ],
  },
};

export default function GuiaTalles() {
  const nombres = Object.keys(TABLAS);
  const [activa, setActiva] = useState(nombres[0]);
  const tabla = TABLAS[activa];

  return (
    <section
      id="guia-de-talles"
      className="scroll-mt-24 border-y border-line bg-panel"
    >
      <div className="mx-auto w-full max-w-[1320px] px-4 py-12 md:px-6 md:py-20 lg:px-14">
        <SectionHead
          eyebrow="Antes de comprar"
          title="Guía de talles"
          sub="Medí sobre el cuerpo, con ropa liviana y el centímetro sin apretar. Si quedás entre dos talles, llevá el más grande."
        />

        <div className="mb-6 flex flex-wrap gap-2">
          {nombres.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setActiva(n)}
              aria-pressed={activa === n}
              className={`h-10 border px-5 font-cond text-[0.84rem] font-semibold uppercase tracking-[0.14em] transition-colors ${
                activa === n
                  ? "border-chalk bg-chalk text-white"
                  : "border-line bg-ink text-mute hover:border-chalk hover:text-chalk"
              }`}
            >
              {n}
            </button>
          ))}
        </div>

        {/* La tabla se desplaza sola de costado en el celular: forzarla a
            entrar en 360 px la vuelve ilegible, y romper la página entera para
            que quepa es peor. */}
        <div className="overflow-x-auto border border-line bg-ink">
          <table className="w-full min-w-[520px] border-collapse text-left">
            <thead>
              <tr className="border-b border-line">
                {tabla.columnas.map((c) => (
                  <th
                    key={c}
                    scope="col"
                    className="px-4 py-3 font-cond text-[0.76rem] font-semibold uppercase tracking-[0.16em] text-mute"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tabla.filas.map((f) => (
                <tr key={f[0]} className="border-b border-line last:border-0 hover:bg-raise">
                  {f.map((celda, i) => (
                    <td
                      key={i}
                      className={`ag-num px-4 py-3 text-[0.9rem] ${
                        i === 0 ? "font-semibold text-chalk" : "text-mute"
                      }`}
                    >
                      {celda}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-[0.85rem] text-dim">
          ¿Seguís con dudas? Escribinos y te decimos qué talle pedir según la prenda.
        </p>
      </div>
    </section>
  );
}

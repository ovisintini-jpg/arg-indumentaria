"use client";

// components/Brands.tsx
//
// La banda de marcas. Un plano de color a todo el ancho, el título a la
// izquierda y los logos en fila a la derecha, con flechas para ver más.
// Va entre los destacados y la guía de talles: corta la parte blanca de la
// home y le da un golpe de color a la mitad de la página.
//
// Cada marca es un botón: al tocarla, la home muestra el catálogo filtrado por
// esa marca (busca en el campo `brand` de cada producto, que es el mismo que
// usa el filtro "Marca" del catálogo). Por eso el nombre de acá tiene que
// estar escrito IGUAL que en Admin → Productos.
//
// ── CÓMO PONER LOS LOGOS ────────────────────────────────────────────────
// 1. Conseguí el logo oficial de cada marca: lo da el distribuidor o está en
//    la sección de prensa de la marca. Tiene que ser en NEGRO (o en un solo
//    color oscuro) y con fondo transparente. SVG si se puede; si no, PNG de
//    400 px de ancho o más.
// 2. Guardalo en  public/images/marcas/   Por ejemplo:  nike.svg
// 3. Escribí la ruta en `logo`, en la lista de abajo:
//       { nombre: "Nike", logo: "/images/marcas/nike.svg" },
// 4. Listo.
//
// SIN LOGO NO QUEDA UN HUECO. La marca se escribe con la tipografía de
// titulares, en negro y grande, así la banda se ve terminada desde el primer
// día y los logos se van sumando de a uno.
//
// Ojo con los permisos: usar el logo de una marca que vendés de verdad es lo
// normal, pero conviene tener el OK del distribuidor por escrito.
// ────────────────────────────────────────────────────────────────────────

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useCategory } from "@/context/CategoryContext";
import { Icon } from "@/components/Icons";

type Marca = { nombre: string; logo: string | null };

const MARCAS: Marca[] = [
  { nombre: "Nike",        logo: "/images/marcas/nike.svg" },
  { nombre: "Adidas",      logo: "/images/marcas/adidas.svg" },
  { nombre: "New Balance", logo: "/images/marcas/new-balance.svg" },
  { nombre: "Puma",        logo: "/images/marcas/puma.svg" },
  { nombre: "Vans",        logo: "/images/marcas/vans.svg" },
  { nombre: "Converse",    logo: "/images/marcas/converse.svg" },
  { nombre: "Reebok",      logo: "/images/marcas/reebok.png" },
];

/* Salmón: la terracota de la marca, aclarada. La tinta (#14120F) encima da
   8,4:1 de contraste, así que título y logos negros se leen sin esfuerzo. */
const FONDO = "#F4966B";

export default function Brands() {
  const { setSearchQuery } = useCategory();
  const pista = useRef<HTMLUListElement>(null);
  const [puedeAtras, setPuedeAtras] = useState(false);
  const [puedeAdelante, setPuedeAdelante] = useState(false);

  /* Las flechas aparecen sólo si hay para dónde ir. Con pocas marcas o una
     pantalla ancha no se dibuja ninguna. */
  const medir = useCallback(() => {
    const el = pista.current;
    if (!el) return;
    setPuedeAtras(el.scrollLeft > 4);
    setPuedeAdelante(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = pista.current;
    if (!el) return;
    // El ResizeObserver mide apenas empieza a observar, así que no hace falta
    // una primera medición a mano (y se evita un setState directo en el efecto).
    el.addEventListener("scroll", medir, { passive: true });
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", medir);
      ro.disconnect();
    };
  }, [medir]);

  /* Cada click corre casi una pantalla de logos; el scroll-snap del carrusel
     lo termina de acomodar para que ningún logo quede cortado al medio. */
  const mover = (sentido: 1 | -1) => {
    const el = pista.current;
    if (!el) return;
    el.scrollBy({ left: sentido * el.clientWidth * 0.8, behavior: "smooth" });
  };

  const verMarca = (nombre: string) => {
    setSearchQuery(nombre);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const flecha =
    "absolute top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center bg-chalk text-white transition-colors hover:bg-black md:h-14 md:w-14";

  return (
    <section
      id="marcas"
      aria-labelledby="marcas-titulo"
      className="flex w-full min-h-[340px] items-center scroll-mt-[124px] md:min-h-[400px] md:scroll-mt-24 lg:min-h-[440px]"
      style={{ background: FONDO }}
    >
      <div className="mx-auto grid w-full max-w-[1320px] items-center gap-7 px-4 py-10 md:grid-cols-[minmax(190px,260px)_1fr] md:gap-10 md:px-6 md:py-16 lg:px-14 lg:py-20">
        <div>
          <p className="mb-2 font-cond text-[0.8rem] font-semibold uppercase tracking-[0.24em] text-chalk/80">
            Marcas
          </p>
          <h2
            id="marcas-titulo"
            className="max-w-[14ch] font-display text-[clamp(1.9rem,5vw,3.6rem)] font-extrabold text-chalk"
          >
            Marcas que pisan fuerte
          </h2>
        </div>

        {/* Las flechas van en el margen del carrusel, no encima: así nunca tapan
            media marca. */}
        <div className="relative min-w-0 px-12 md:px-16">
          <ul ref={pista} className="ag-carrusel" aria-label="Marcas disponibles">
            {MARCAS.map((m) => (
              <li key={m.nombre} className="w-1/2 sm:w-1/3 lg:w-1/4">
                <button
                  type="button"
                  onClick={() => verMarca(m.nombre)}
                  aria-label={`Ver productos ${m.nombre}`}
                  className="group flex h-28 w-full items-center justify-center px-3 text-chalk md:h-32 md:px-5"
                >
                  {m.logo ? (
                    <span className="relative block h-14 w-full transition-transform duration-200 group-hover:-translate-y-1 md:h-20">
                      <Image
                        src={m.logo}
                        alt=""
                        fill
                        sizes="(min-width: 1024px) 220px, (min-width: 640px) 25vw, 40vw"
                        unoptimized={m.logo.endsWith(".svg")}
                        className="object-contain"
                      />
                    </span>
                  ) : (
                    <span className="text-center font-display text-[1.3rem] font-extrabold uppercase leading-[0.92] tracking-[-0.04em] transition-transform duration-200 group-hover:-translate-y-1 md:text-[1.6rem]">
                      {m.nombre}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>

          {puedeAtras && (
            <button
              type="button"
              onClick={() => mover(-1)}
              aria-label="Marcas anteriores"
              className={`${flecha} left-0`}
            >
              <Icon name="chev" size={20} className="rotate-90" />
            </button>
          )}
          {puedeAdelante && (
            <button
              type="button"
              onClick={() => mover(1)}
              aria-label="Más marcas"
              className={`${flecha} right-0`}
            >
              <Icon name="chev" size={20} className="-rotate-90" />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

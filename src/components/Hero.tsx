"use client";

import Link from "next/link";
import { useCategory } from "@/context/CategoryContext";
import { Icon } from "@/components/Icons";

/* ───────────────────────────────────────────────────────────────────────────
   EL HERO

   Está armado para funcionar SIN UNA SOLA FOTO y para mejorar cuando las
   fotos existan. Es la diferencia entre una tienda que arranca vacía y una que
   arranca presentable: el bloque de color con tipografía grande es un recurso
   editorial de toda la vida (Nordstrom Rack lo usa para sus campañas) y no
   parece un hueco esperando una imagen.

   La estructura es la de cualquier tienda del rubro:
     · un bloque grande de campaña, con un solo mensaje y un solo botón;
     · dos bloques chicos al costado que mandan a los dos departamentos que
       más venden (mujer y hombre);
     · abajo, la fila de departamentos, que es el atajo real —el visitante que
       ya sabe qué busca no lee el titular, va directo a su sección.

   PARA PONER FOTOS: el bloque grande y los dos chicos aceptan una foto de
   fondo. Guardá la imagen en public/images y escribila en FOTO_CAMPANA /
   FOTO_MUJER / FOTO_HOMBRE, acá abajo. El texto ya está preparado para leerse
   encima (clase ag-title-foto + velo).
   ─────────────────────────────────────────────────────────────────────────── */

const FOTO_CAMPANA: string | null = "/images/hero-campana.jpg";
const FOTO_MUJER:   string | null = "/images/hero-mujer.jpg";
const FOTO_HOMBRE:  string | null = "/images/hero-hombre.jpg";

/** Los atajos de abajo del hero. Van en el mismo orden que las categorías. */
const DEPARTAMENTOS = [
  { id: "mujer",            label: "Mujer" },
  { id: "hombre",           label: "Hombre" },
  { id: "ninas",            label: "Niñas" },
  { id: "ninos",            label: "Niños" },
  { id: "bebes",            label: "Bebés" },
  { id: "calzado-mujer",    label: "Calzado" },
  { id: "deportivo",        label: "Deportivo" },
  { id: "accesorios",       label: "Accesorios" },
];

function fondo(foto: string | null, color: string) {
  return foto
    ? {
        backgroundImage:
          `linear-gradient(90deg, rgba(0,0,0,.60) 0%, rgba(0,0,0,.25) 55%, rgba(0,0,0,.05) 100%), url(${foto})`,
        backgroundSize: "cover",
        backgroundPosition: "center 35%",
      }
    : { background: color };
}

export default function Hero() {
  const { setCategory } = useCategory();

  return (
    <section aria-label="Presentación" className="border-b border-line">
      <div className="mx-auto w-full max-w-[1320px] px-4 pb-10 pt-6 md:px-6 md:pb-14 md:pt-10 lg:px-14">

        <div className="grid gap-3 lg:grid-cols-[1.7fr_1fr]">

          {/* ── Bloque de campaña ── */}
          <div
            className="ag-rise ag-d1 relative flex min-h-[380px] flex-col justify-end p-6 md:min-h-[520px] md:p-12"
            style={fondo(FOTO_CAMPANA, "#14120F")}
          >
            <p className="font-cond text-[0.82rem] font-semibold uppercase tracking-[0.26em] text-white/70">
              Temporada 2026
            </p>
            <h1 className="ag-title-foto mt-4 max-w-[14ch] font-display text-[clamp(2.4rem,7vw,4.6rem)] font-black leading-[0.96] tracking-[-0.04em]">
              Vestite bien.
              <br />
              Pagalo mejor.
            </h1>
            <p className="mt-5 max-w-[44ch] text-[1rem] text-white/80">
              Indumentaria y calzado para toda la familia. Envíos a todo el país,
              cambios sin cargo y hasta 6 cuotas sin interés.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/categoria/novedades" className="ag-btn ag-btn-claro">
                Ver novedades <Icon name="arrow" size={18} />
              </Link>
              <Link
                href="/categoria/outlet"
                className="ag-btn border-white/70 text-white transition-colors hover:bg-white hover:text-chalk"
              >
                Outlet
              </Link>
            </div>
          </div>

          {/* ── Dos bloques de departamento ── */}
          <div className="ag-rise ag-d2 grid gap-3">
            {[
              { id: "mujer",  label: "Mujer",  foto: FOTO_MUJER,  color: "#E8DFCD", tinta: "#14120F" },
              { id: "hombre", label: "Hombre", foto: FOTO_HOMBRE, color: "#DCD9D2", tinta: "#14120F" },
            ].map((b) => (
              <Link
                key={b.id}
                href={`/categoria/${b.id}`}
                className="group relative flex min-h-[180px] items-end overflow-hidden p-6 md:min-h-[254px]"
                style={fondo(b.foto, b.color)}
              >
                <span className="relative z-10">
                  <span
                    className={`block font-display text-[1.9rem] font-extrabold uppercase tracking-[-0.03em] md:text-[2.2rem] ${
                      b.foto ? "ag-title-foto" : ""
                    }`}
                    style={b.foto ? undefined : { color: b.tinta }}
                  >
                    {b.label}
                  </span>
                  <span
                    className="mt-1 inline-flex items-center gap-2 font-cond text-[0.82rem] font-semibold uppercase tracking-[0.2em] transition-transform duration-300 group-hover:translate-x-1"
                    style={{ color: b.foto ? "#fff" : b.tinta, opacity: 0.75 }}
                  >
                    Ver la sección <Icon name="arrow" size={15} />
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* ── Fila de departamentos ──
            El atajo de verdad. En el celular se arrastra de costado en vez de
            apilarse: ocho botones apilados empujan el catálogo abajo de todo. */}
        <nav aria-label="Departamentos" className="ag-rise ag-d3 mt-8 md:mt-10">
          <ul className="ag-carrusel gap-2 md:flex-wrap md:justify-center">
            {DEPARTAMENTOS.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/categoria/${d.id}`}
                  onClick={() => setCategory(d.id, null, d.label.toUpperCase())}
                  className="inline-flex h-11 items-center border border-line px-5 font-cond text-[0.88rem] font-semibold uppercase tracking-[0.14em] text-mute transition-colors hover:border-chalk hover:bg-chalk hover:text-white"
                >
                  {d.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </section>
  );
}

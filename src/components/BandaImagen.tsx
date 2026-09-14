// components/BandaImagen.tsx
//
// Bandas a todo el ancho, entre secciones. Son el respiro visual de la home y
// además el lugar donde vive la campaña de la temporada.
//
// Hay tres, y las tres salen de este archivo. Se llaman "ranuras":
//
//   temporada  → entre las categorías y los destacados
//   editorial  → entre los destacados y las reseñas
//   cierre     → antes de las marcas, para cerrar la página
//
// ── CÓMO PONER LAS FOTOS ────────────────────────────────────────────────
// 1. Guardá las imágenes en  public/images/
//    Horizontales, de 1600 px de ancho o más. Fotos de producción (personas
//    con la ropa puesta) antes que fotos de prenda sola: es lo que vende.
// 2. Escribí el nombre de cada una acá abajo, en FOTOS. Por ejemplo:
//       temporada: "/images/banda-temporada.jpg",
// 3. Listo.
//
// SIN FOTO NO QUEDA UN HUECO. La banda se dibuja igual como un bloque de
// color plano con el título encima —el recurso de Nordstrom Rack y de
// JCPenney para las campañas— así que la home se ve terminada desde el
// primer día y las fotos se van sumando cuando estén.
// ────────────────────────────────────────────────────────────────────────

import Image from "next/image";
import Link from "next/link";

export type Ranura = "temporada" | "editorial" | "cierre";

const FOTOS: Record<Ranura, string | null> = {
  temporada: null,
  editorial: null,
  cierre: null,
};

/** Qué parte de la foto se ve, ya que la banda es más ancha que alta y hay que
    recortar. "center 40%" = centrada a lo ancho, sobre la parte de arriba (que
    en una foto de moda es donde está la cara). */
const POSICION: Record<Ranura, string> = {
  temporada: "center 38%",
  editorial: "center 42%",
  cierre: "center 45%",
};

/** Texto alternativo para lectores de pantalla, uno por ranura.
    Cambialo junto con cada foto para que describa lo que se ve. */
const ALTS: Record<Ranura, string> = {
  temporada: "Campaña de temporada de ARG Indumentaria",
  editorial: "Producción de moda de ARG Indumentaria",
  cierre: "Local de ARG Indumentaria",
};

/** El contenido de cada banda. El texto va SIEMPRE, haya foto o no. */
const CONTENIDO: Record<
  Ranura,
  { volanta: string; titulo: string; bajada?: string; cta: string; href: string; fondo: string; tinta: string }
> = {
  temporada: {
    volanta: "Nueva temporada",
    titulo: "Lo que se viene, ya está acá",
    bajada: "Las primeras entregas de la colección, en todos los talles.",
    cta: "Ver novedades",
    href: "/categoria/novedades",
    fondo: "#14120F",
    tinta: "#FFFFFF",
  },
  editorial: {
    volanta: "Outlet",
    titulo: "Hasta 50% en la temporada pasada",
    bajada: "Precios finales. Mientras haya talles.",
    cta: "Ver outlet",
    href: "/categoria/outlet",
    fondo: "#C1272D",
    tinta: "#FFFFFF",
  },
  cierre: {
    volanta: "Calzado",
    titulo: "Zapatillas, botas y sandalias",
    bajada: "Numeración completa para toda la familia.",
    cta: "Ver calzado",
    href: "/categoria/calzado-mujer",
    fondo: "#E8DFCD",
    tinta: "#14120F",
  },
};

/* Rectángulo de 8x3 px: es el color plano que se ve un instante mientras carga
   la foto, así el hueco no parpadea en blanco. Va escrito como base64 literal a
   propósito: este componente viaja al navegador y ahí no hay Buffer. */
const BLUR =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjMiPjxyZWN0IHdpZHRoPSI4IiBoZWlnaHQ9IjMiIGZpbGw9IiNGMUVGRUIiLz48L3N2Zz4=";

export default function BandaImagen({ ranura }: { ranura: Ranura }) {
  const foto = FOTOS[ranura];
  const c = CONTENIDO[ranura];
  const sobreFoto = Boolean(foto);

  return (
    <section
      aria-label={c.titulo}
      className="relative flex w-full min-h-[340px] items-center overflow-hidden md:min-h-[400px] lg:min-h-[440px]"
      style={{ background: c.fondo }}
    >
      {foto && (
        <Image
          src={foto}
          alt={ALTS[ranura]}
          fill
          sizes="100vw"
          placeholder="blur"
          blurDataURL={BLUR}
          className="object-cover"
          style={{ objectPosition: POSICION[ranura] }}
        />
      )}

      {/* Velo: sólo cuando hay foto, y sólo del lado del texto. Un velo parejo
          apaga la foto entera; este deja la imagen limpia a la derecha. */}
      {sobreFoto && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, rgba(0,0,0,.62) 0%, rgba(0,0,0,.30) 48%, rgba(0,0,0,0) 78%)",
          }}
        />
      )}

      <div className="relative mx-auto flex w-full max-w-[1320px] flex-col items-start gap-5 px-4 py-12 md:px-6 md:py-16 lg:px-14 lg:py-20">
        <p
          className="font-cond text-[0.8rem] font-semibold uppercase tracking-[0.24em]"
          style={{ color: sobreFoto ? "rgba(255,255,255,.82)" : c.tinta, opacity: sobreFoto ? 1 : 0.7 }}
        >
          {c.volanta}
        </p>

        <h2
          className={`max-w-[16ch] font-display text-[clamp(1.9rem,5vw,3.6rem)] font-extrabold ${
            sobreFoto ? "ag-title-foto" : ""
          }`}
          style={sobreFoto ? undefined : { color: c.tinta }}
        >
          {c.titulo}
        </h2>

        {c.bajada && (
          <p
            className="max-w-[42ch] text-[1rem]"
            style={{ color: sobreFoto ? "rgba(255,255,255,.9)" : c.tinta, opacity: sobreFoto ? 1 : 0.78 }}
          >
            {c.bajada}
          </p>
        )}

        <Link
          href={c.href}
          className={`ag-btn mt-1 ${c.tinta === "#FFFFFF" || sobreFoto ? "ag-btn-claro" : "ag-btn-solid"}`}
        >
          {c.cta}
        </Link>
      </div>
    </section>
  );
}

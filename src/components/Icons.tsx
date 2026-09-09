// components/Icons.tsx
//
// Iconografía dibujada a mano, del mundo de la ropa y el calzado.
// Trazo de 1.6 sobre grilla de 48 para las prendas, 24 para la interfaz.
//
// Los íconos de prenda son SIEMPRE de contorno y sin relleno: se apoyan sobre
// papel claro y tienen que convivir con la fotografía sin robarle atención.
// Cuando hay foto de producto, la foto gana y el ícono no se dibuja.
import React from "react";

export type IconName =
  // prendas y calzado (grilla 48)
  | "vestido" | "remera" | "nina" | "nino" | "body"
  | "taco" | "zapatilla" | "botita" | "deportivo" | "interior" | "bolso"
  // interfaz (grilla 24)
  | "search" | "user" | "cart" | "chev" | "plus" | "minus" | "arrow"
  | "check" | "close" | "heart" | "truck" | "cambio" | "escudo"
  | "estrella" | "filtro" | "regla";

const S = { fill: "none", stroke: "currentColor" } as const;
const R = { strokeLinecap: "round", strokeLinejoin: "round" } as const;

const ICONS: Record<IconName, { box: string; art: React.ReactNode }> = {
  // ── Prendas ────────────────────────────────────────────────────
  vestido: {
    box: "0 0 48 48",
    art: (
      <>
        <path d="M19 8h10l-1.5 12L33 40H15l5.5-20z" {...S} {...R} strokeWidth="1.6" />
        <path d="M19 8l-5 4 2.6 3.6M29 8l5 4-2.6 3.6" {...S} {...R} strokeWidth="1.6" />
        <path d="M19.4 8.4c1.6 2.6 7.6 2.6 9.2 0" {...S} {...R} strokeWidth="1.2" />
        <path d="M20.5 21h7" {...S} {...R} strokeWidth="1.2" opacity=".7" />
      </>
    ),
  },
  remera: {
    box: "0 0 48 48",
    art: (
      <>
        <path d="M18.5 9L10 13.5l3 6.5 4-1.8V39h14V18.2l4 1.8 3-6.5L29.5 9" {...S} {...R} strokeWidth="1.6" />
        <path d="M18.5 9c0 3.2 11 3.2 11 0" {...S} {...R} strokeWidth="1.6" />
      </>
    ),
  },
  nina: {
    box: "0 0 48 48",
    art: (
      <>
        <path d="M18 13h12l-1 8 6 19H13l6-19z" {...S} {...R} strokeWidth="1.6" />
        <path d="M20 13V9M28 13V9" {...S} {...R} strokeWidth="1.4" />
        <path d="M21 22h6" {...S} {...R} strokeWidth="1.2" opacity=".7" />
        <path d="M22 10.5l-3-2v4zM26 10.5l3-2v4z" {...S} {...R} strokeWidth="1.2" />
      </>
    ),
  },
  nino: {
    box: "0 0 48 48",
    art: (
      <>
        <path d="M14 12h20v6l-1.5 14h-7L24 21l-1.5 11h-7L14 18z" {...S} {...R} strokeWidth="1.6" />
        <path d="M14 18h20" {...S} {...R} strokeWidth="1.2" opacity=".7" />
      </>
    ),
  },
  body: {
    box: "0 0 48 48",
    art: (
      <>
        <path d="M19 10h10l5 5.5-4 3v8.5a6 6 0 0 1-6 6 6 6 0 0 1-6-6v-8.5l-4-3z" {...S} {...R} strokeWidth="1.6" />
        <path d="M19 10.4c1.4 2.4 8.6 2.4 10 0" {...S} {...R} strokeWidth="1.2" />
        <g fill="currentColor" opacity=".8">
          <circle cx="21" cy="30" r="1.1" /><circle cx="24" cy="30.6" r="1.1" /><circle cx="27" cy="30" r="1.1" />
        </g>
      </>
    ),
  },
  // ── Calzado ────────────────────────────────────────────────────
  taco: {
    box: "0 0 48 48",
    art: (
      <>
        <path d="M12 33V16c3.2 0 4.6 3.2 6.6 6 2.4 3.4 6 5.4 11.4 6.4l6 1.1V33z" {...S} {...R} strokeWidth="1.6" />
        <path d="M30 33v6h5v-6" {...S} {...R} strokeWidth="1.6" />
        <path d="M12 33h24" {...S} {...R} strokeWidth="1.2" opacity=".7" />
      </>
    ),
  },
  zapatilla: {
    box: "0 0 48 48",
    art: (
      <>
        <path d="M9 31v-9c3.2 0 5.4 1.2 7.4 3.2l3.6 2.2h9.4c4.4 0 9.6 1.8 9.6 5.2V33a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2z" {...S} {...R} strokeWidth="1.6" />
        <path d="M9 31h30" {...S} {...R} strokeWidth="1.2" opacity=".7" />
        <path d="M17 24.6l3-3.4M21 27l3.4-3.8M25.4 27.4l3.4-3.4" {...S} {...R} strokeWidth="1.2" opacity=".8" />
      </>
    ),
  },
  botita: {
    box: "0 0 48 48",
    art: (
      <>
        <path d="M16 10h9v11c0 4 4.5 6 8.5 8 2.6 1.3 3.5 2.6 3.5 4.6V35H16z" {...S} {...R} strokeWidth="1.6" />
        <path d="M16 30.5h21" {...S} {...R} strokeWidth="1.2" opacity=".7" />
        <path d="M18.5 14h4M18.5 18h4M18.5 22h4" {...S} {...R} strokeWidth="1.2" opacity=".8" />
      </>
    ),
  },
  deportivo: {
    box: "0 0 48 48",
    art: (
      <>
        <path d="M19 9c0 3.6 10 3.6 10 0l6.5 3.4-2.2 7.2-3.3-1.2V39H17V18.4l-3.3 1.2-2.2-7.2z" {...S} {...R} strokeWidth="1.6" />
        <path d="M21 25h6M21 29h6" {...S} {...R} strokeWidth="1.4" opacity=".75" />
      </>
    ),
  },
  interior: {
    box: "0 0 48 48",
    art: (
      <>
        <path d="M12 20c0 6.5 4.4 9.6 12 9.6S36 26.5 36 20" {...S} {...R} strokeWidth="1.6" />
        <path d="M12 20h24" {...S} {...R} strokeWidth="1.6" />
        <path d="M12 20l5.5-8M36 20l-5.5-8" {...S} {...R} strokeWidth="1.4" />
        <path d="M24 29.6V20" {...S} {...R} strokeWidth="1.2" opacity=".7" />
      </>
    ),
  },
  bolso: {
    box: "0 0 48 48",
    art: (
      <>
        <path d="M12.5 17h23l-2 20h-19z" {...S} {...R} strokeWidth="1.6" />
        <path d="M19 17v-3.5a5 5 0 0 1 10 0V17" {...S} {...R} strokeWidth="1.6" />
        <path d="M14.5 23h19" {...S} {...R} strokeWidth="1.1" opacity=".6" />
      </>
    ),
  },

  // ── Interfaz ───────────────────────────────────────────────────
  search: {
    box: "0 0 24 24",
    art: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" {...S} strokeWidth="1.8" />
        <path d="M15.4 15.4L21 21" {...S} {...R} strokeWidth="1.8" />
      </>
    ),
  },
  user: {
    box: "0 0 24 24",
    art: (
      <>
        <circle cx="12" cy="8" r="3.8" {...S} strokeWidth="1.7" />
        <path d="M4.5 20.5c0-4.1 3.4-6.5 7.5-6.5s7.5 2.4 7.5 6.5" {...S} {...R} strokeWidth="1.7" />
      </>
    ),
  },
  /* La bolsa reemplaza al changuito: en indumentaria el carrito se dibuja
     como bolsa de tienda en todas las marcas del rubro. */
  cart: {
    box: "0 0 24 24",
    art: (
      <>
        <path d="M5 7.5h14l1 13H4z" {...S} {...R} strokeWidth="1.7" />
        <path d="M9 10V6.2a3 3 0 0 1 6 0V10" {...S} {...R} strokeWidth="1.7" />
      </>
    ),
  },
  chev: {
    box: "0 0 24 24",
    art: <path d="M6 9l6 6 6-6" {...S} {...R} strokeWidth="2" />,
  },
  plus: {
    box: "0 0 24 24",
    art: <path d="M12 5v14M5 12h14" {...S} {...R} strokeWidth="1.9" />,
  },
  minus: {
    box: "0 0 24 24",
    art: <path d="M5 12h14" {...S} {...R} strokeWidth="1.9" />,
  },
  arrow: {
    box: "0 0 24 24",
    art: <path d="M4 12h15M13 6l6 6-6 6" {...S} {...R} strokeWidth="1.9" />,
  },
  check: {
    box: "0 0 24 24",
    art: <path d="M4 12.5l5.5 5.5L20 7" {...S} {...R} strokeWidth="2" />,
  },
  close: {
    box: "0 0 24 24",
    art: <path d="M6 6l12 12M18 6L6 18" {...S} {...R} strokeWidth="1.9" />,
  },
  heart: {
    box: "0 0 24 24",
    art: (
      <path
        d="M12 20.2S3.8 15.4 3.8 9.6A4.6 4.6 0 0 1 12 6.8a4.6 4.6 0 0 1 8.2 2.8c0 5.8-8.2 10.6-8.2 10.6z"
        {...S} {...R} strokeWidth="1.7"
      />
    ),
  },
  truck: {
    box: "0 0 24 24",
    art: (
      <>
        <path d="M2.5 6h11v10h-11zM13.5 9.5H18l3.5 3.5V16h-8z" {...S} {...R} strokeWidth="1.6" />
        <circle cx="7" cy="18" r="1.9" {...S} strokeWidth="1.6" />
        <circle cx="17" cy="18" r="1.9" {...S} strokeWidth="1.6" />
      </>
    ),
  },
  cambio: {
    box: "0 0 24 24",
    art: (
      <>
        <path d="M3.5 9.5A8.5 8.5 0 0 1 18 5.5M20.5 14.5A8.5 8.5 0 0 1 6 18.5" {...S} {...R} strokeWidth="1.7" />
        <path d="M18 2v4h-4M6 22v-4h4" {...S} {...R} strokeWidth="1.7" />
      </>
    ),
  },
  escudo: {
    box: "0 0 24 24",
    art: (
      <>
        <path d="M12 2.8l7.5 3v6c0 5-3.4 8.3-7.5 9.4-4.1-1.1-7.5-4.4-7.5-9.4v-6z" {...S} {...R} strokeWidth="1.6" />
        <path d="M8.8 12l2.4 2.4 4.2-4.6" {...S} {...R} strokeWidth="1.6" />
      </>
    ),
  },
  estrella: {
    box: "0 0 24 24",
    art: (
      <path d="M12 3.2l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.7l6.1-.9z"
            {...S} {...R} strokeWidth="1.5" />
    ),
  },
  filtro: {
    box: "0 0 24 24",
    art: (
      <>
        <path d="M3.5 7h17M3.5 12h17M3.5 17h17" {...S} {...R} strokeWidth="1.6" />
        <circle cx="8" cy="7" r="2.2" fill="currentColor" />
        <circle cx="15" cy="12" r="2.2" fill="currentColor" />
        <circle cx="10" cy="17" r="2.2" fill="currentColor" />
      </>
    ),
  },
  regla: {
    box: "0 0 24 24",
    art: (
      <>
        <path d="M2.5 8.5h19v7h-19z" {...S} {...R} strokeWidth="1.6" />
        <path d="M6.5 8.5v3.4M10 8.5v2M13.5 8.5v3.4M17 8.5v2" {...S} {...R} strokeWidth="1.4" />
      </>
    ),
  },
};

export function Icon({
  name,
  size = 24,
  className = "",
}: {
  name: IconName;
  size?: number | string;
  className?: string;
}) {
  const def = ICONS[name];
  return (
    <svg
      viewBox={def.box}
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {def.art}
    </svg>
  );
}

export default Icon;

/* Ícono por categoría. Si el admin crea una categoría nueva, cae en "remera". */
export const CATEGORY_ICON: Record<string, IconName> = {
  mujer:            "vestido",
  hombre:           "remera",
  ninas:            "nina",
  ninos:            "nino",
  bebes:            "body",
  "calzado-mujer":  "taco",
  "calzado-hombre": "zapatilla",
  "calzado-infantil": "botita",
  deportivo:        "deportivo",
  interior:         "interior",
  accesorios:       "bolso",
};

export function categoryIcon(id?: string): IconName {
  return (id && CATEGORY_ICON[id]) || "remera";
}

/* Ícono por PRODUCTO. Mientras no hay foto cargada, el ícono es lo único que
   se ve en la tarjeta: con el ícono de la categoría, todo "Mujer" salía con el
   mismo vestido, incluidas las remeras y los jeans. Acá se mira primero la
   subcategoría y después el título, y recién al final se cae a la categoría.
   Es una heurística por palabras, no una ciencia: alcanza para que la grilla
   se lea, y desaparece apenas hay foto. */
const POR_PALABRA: [RegExp, IconName][] = [
  [/zapatilla|sneaker|running|deportiv/i, "zapatilla"],
  [/bota|borceg|botineta|botita/i,        "botita"],
  [/sandalia|ojota|chatita|mocas|zapato|taco/i, "taco"],
  [/vestido|pollera|falda/i,              "vestido"],
  [/pantal|jean|calza|jogging|bermuda|short|malla/i, "nino"],
  [/body|enterito|ajuar|beb[eé]/i,        "body"],
  [/lencer|corpi|bombacha|boxer|interior|pijama|camis[oó]n|media/i, "interior"],
  [/mochila|cartera|bolso|rinion|gorra|cintur|lentes|bufanda|guante|reloj/i, "bolso"],
  [/camiseta|musculosa|training|f[uú]tbol/i, "deportivo"],
  [/remera|chomba|camisa|blusa|buzo|sweater|campera|abrigo|blazer|saco|top/i, "remera"],
];

export function productIcon(p: {
  subcategory?: string;
  title?: string;
  categoryId?: string;
}): IconName {
  const texto = `${p.subcategory ?? ""} ${p.title ?? ""}`;
  for (const [re, icono] of POR_PALABRA) if (re.test(texto)) return icono;
  return categoryIcon(p.categoryId);
}

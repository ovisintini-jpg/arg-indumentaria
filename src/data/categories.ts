// src/data/categories.ts
import { Category, Especial } from "@/types";

/* Las categorías de arranque de ARG Indumentaria.
   El orden es el de una tienda de verdad: primero por persona (mujer,
   hombre, chicos), después calzado, y al final lo transversal (deportivo,
   ropa interior, accesorios). Son 11, que con la baldosa "Ver todo el
   catálogo" dan 12: la grilla de la home cierra justa en tres filas de
   cuatro.

   Los ids tienen que coincidir con CATEGORY_ICON en components/Icons.tsx
   para que cada categoría muestre su ícono, y con los ids de la tabla
   `categories` de Supabase (ver supabase/parches/categorias.sql). */

export const categories: Category[] = [
  {
    id: "mujer",
    name: "MUJER",
    subCategories: [
      "Remeras y tops",
      "Camisas y blusas",
      "Vestidos",
      "Pantalones y jeans",
      "Faldas y shorts",
      "Buzos y sweaters",
      "Camperas y abrigos",
      "Blazers y sastrería",
      "Trajes de baño",
    ],
  },
  {
    id: "hombre",
    name: "HOMBRE",
    subCategories: [
      "Remeras y chombas",
      "Camisas",
      "Pantalones y jeans",
      "Bermudas y shorts",
      "Buzos y sweaters",
      "Camperas y abrigos",
      "Trajes y sacos",
      "Mallas",
    ],
  },
  {
    id: "ninas",
    name: "NIÑAS",
    subCategories: [
      "Remeras y tops",
      "Vestidos y polleras",
      "Pantalones y calzas",
      "Buzos y camperas",
      "Conjuntos",
      "Escolar",
    ],
  },
  {
    id: "ninos",
    name: "NIÑOS",
    subCategories: [
      "Remeras",
      "Pantalones y joggings",
      "Bermudas",
      "Buzos y camperas",
      "Conjuntos",
      "Escolar",
    ],
  },
  {
    id: "bebes",
    name: "BEBÉS",
    subCategories: [
      "Bodies y enteritos",
      "Conjuntos",
      "Pilotines y abrigos",
      "Ajuar y primera puesta",
      "Gorros y medias",
    ],
  },
  {
    id: "calzado-mujer",
    name: "CALZADO MUJER",
    subCategories: [
      "Zapatillas urbanas",
      "Botas y botinetas",
      "Sandalias",
      "Chatitas y mocasines",
      "Zapatos de vestir",
      "Ojotas",
    ],
  },
  {
    id: "calzado-hombre",
    name: "CALZADO HOMBRE",
    subCategories: [
      "Zapatillas urbanas",
      "Zapatillas deportivas",
      "Botas y borcegos",
      "Zapatos de vestir",
      "Mocasines",
      "Ojotas y sandalias",
    ],
  },
  {
    id: "calzado-infantil",
    name: "CALZADO INFANTIL",
    subCategories: [
      "Zapatillas",
      "Botitas de bebé",
      "Sandalias",
      "Escolar",
      "Pantuflas",
    ],
  },
  {
    id: "deportivo",
    name: "DEPORTIVO",
    subCategories: [
      "Running",
      "Training y gimnasio",
      "Fútbol",
      "Outdoor y trekking",
      "Conjuntos deportivos",
      "Camisetas de club",
    ],
  },
  {
    id: "interior",
    name: "ROPA INTERIOR Y PIJAMAS",
    subCategories: [
      "Lencería",
      "Ropa interior masculina",
      "Pijamas y camisones",
      "Medias",
      "Ropa térmica",
    ],
  },
  {
    id: "accesorios",
    name: "ACCESORIOS",
    subCategories: [
      "Carteras y bolsos",
      "Mochilas",
      "Cinturones",
      "Gorras y sombreros",
      "Bufandas y guantes",
      "Lentes de sol",
      "Relojes y joyas",
    ],
  },
];

/* Las tres listas que no son una categoría sino un estado del producto.
   Se corresponden con los campos isNew / isExclusive / isOutlet. */
export const especiales: Especial[] = [
  { id: "novedades",  name: "NOVEDADES" },
  { id: "exclusivos", name: "SELECCIÓN ARG" },
  { id: "outlet",     name: "OUTLET" },
];

/* ── Talles ────────────────────────────────────────────────────────
   Las escalas que se ofrecen al cargar un producto en el panel. No son una
   regla: un producto puede tener los talles que quiera. Están acá para que
   el admin no los escriba a mano cada vez y para que la tienda entera use
   la misma nomenclatura (que es lo que después permite filtrar por talle). */
export const ESCALAS_DE_TALLE = {
  letras:   ["XS", "S", "M", "L", "XL", "XXL"],
  numerica: ["36", "38", "40", "42", "44", "46", "48"],
  jean:     ["24", "26", "28", "30", "32", "34", "36", "38", "40", "42"],
  calzadoMujer:  ["34", "35", "36", "37", "38", "39", "40", "41"],
  calzadoHombre: ["39", "40", "41", "42", "43", "44", "45", "46"],
  calzadoInfantil: ["19", "20", "21", "22", "23", "24", "25", "26", "27", "28",
                    "29", "30", "31", "32", "33", "34"],
  ninos:    ["2", "4", "6", "8", "10", "12", "14", "16"],
  bebes:    ["RN", "0-3 M", "3-6 M", "6-9 M", "9-12 M", "12-18 M", "18-24 M"],
  unico:    ["Único"],
} as const;

/* ── Colores ───────────────────────────────────────────────────────
   La paleta con la que se cargan las prendas. El nombre es el que ve el
   cliente; el hex es sólo la muestra redonda de la ficha, no pretende ser
   el color exacto de la tela. Los estampados llevan un degradé para que se
   note de un vistazo que no son un color plano. */
export const COLORES = [
  { name: "Negro",     hex: "#161616" },
  { name: "Blanco",    hex: "#F7F5F1" },
  { name: "Crudo",     hex: "#E8DFCD" },
  { name: "Beige",     hex: "#C8B49A" },
  { name: "Camel",     hex: "#A9762F" },
  { name: "Marrón",    hex: "#5A3A24" },
  { name: "Gris",      hex: "#8C8C8C" },
  { name: "Gris melange", hex: "#B9B6B0" },
  { name: "Azul",      hex: "#1F3A66" },
  { name: "Celeste",   hex: "#8FB6D9" },
  { name: "Denim",     hex: "#42648F" },
  { name: "Verde",     hex: "#2F5D3A" },
  { name: "Verde militar", hex: "#4A5233" },
  { name: "Rojo",      hex: "#A32222" },
  { name: "Bordó",     hex: "#5E1F2A" },
  { name: "Rosa",      hex: "#D9A0A8" },
  { name: "Fucsia",    hex: "#B12A6B" },
  { name: "Lila",      hex: "#9B8AC4" },
  { name: "Amarillo",  hex: "#D8A930" },
  { name: "Naranja",   hex: "#C8632A" },
  { name: "Estampado", hex: "linear-gradient(135deg,#E8DFCD 0 33%,#A32222 33% 66%,#1F3A66 66%)" },
  { name: "Rayado",    hex: "repeating-linear-gradient(45deg,#F7F5F1 0 4px,#1F3A66 4px 8px)" },
  { name: "Animal print", hex: "linear-gradient(135deg,#C8B49A 0 40%,#5A3A24 40% 55%,#C8B49A 55%)" },
] as const;

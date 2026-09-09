import { createBrowserClient } from "@supabase/ssr";

// Si .env.local todavía no tiene los valores, usamos un destino inofensivo:
// las consultas fallan y la UI muestra su estado vacío, en vez de que la app
// entera se caiga al importar este módulo.
const CONFIGURADO = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export const supabaseConfigurado = CONFIGURADO;

const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL     || "http://localhost:54321";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sin-configurar";

if (!CONFIGURADO && typeof window !== "undefined") {
  console.warn(
    "[ARG Indumentaria] Falta configurar NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local. " +
    "La tienda se ve, pero el catálogo, el login y los pedidos no van a funcionar."
  );
}

// cookieOptions debe coincidir EXACTAMENTE con los del proxy.ts
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
  cookieOptions: {
    name:     "sb-session",
    path:     "/",
    sameSite: "lax",
    secure:   process.env.NODE_ENV === "production", // false en dev → funciona en HTTP + IP
  },
});

// ── Helpers de mapeo DB (snake_case) ↔ TypeScript (camelCase) ────────────────

export function productFromDB(row: Record<string, unknown>) {
  return {
    id:          row.id          as string,
    title:       row.title       as string,
    price:       row.price       as number,
    cost_price:  (row.cost_price as number) ?? 0,
    icon:        (row.icon       as string) ?? "📦",
    image:       row.image       as string | undefined,
    images:      row.images      as string[] | undefined,
    categoryId:  row.category_id as string,
    subcategory: row.subcategory as string | undefined,
    slug:        row.slug        as string | undefined,
    brand:       row.brand       as string | undefined,
    sku:         row.sku         as string | undefined,
    description: row.description as string | undefined,
    stock:       (row.stock      as number) ?? 0,
    isNew:       (row.is_new       as boolean) ?? false,
    isExclusive: (row.is_exclusive as boolean) ?? false,
    isOutlet:    (row.is_outlet    as boolean) ?? false,

    // Indumentaria. Sin supabase/parches/indumentaria.sql estas columnas no
    // existen todavía y quedan en undefined: la tienda funciona igual, pero
    // sin selector de talle ni de color.
    price_before:    (row.price_before as number) ?? undefined,
    genero:          row.genero as import("@/types").Genero | undefined,
    sizes:           (row.sizes  as string[]) ?? undefined,
    colors:          (row.colors as import("@/types").ColorVariante[]) ?? undefined,
    stock_variantes: (row.stock_variantes as import("@/types").StockVariantes) ?? undefined,
    material:        row.material    as string | undefined,
    composicion:     row.composicion as string | undefined,
    cuidados:        row.cuidados    as string | undefined,

    // Piezas a pedido. Sin supabase/parches/pedidos-especiales.sql estas
    // columnas no existen todavia y quedan en undefined: nadie las lee.
    visibilidad:    (row.visibilidad as "catalogo" | "privado") ?? "catalogo",
    token:          row.token          as string | undefined,
    envio_costo:    Number(row.envio_costo ?? 0),
    cliente_nombre: row.cliente_nombre as string | undefined,
    cliente_email:  row.cliente_email  as string | undefined,
    consulta_id:    row.consulta_id    as string | undefined,
    vence_el:       row.vence_el       as string | undefined,
    detalle:        row.detalle        as string | undefined,
  };
}

/** Payload de una PEDIDO POR ENCARGO. Aparte de productToDB a proposito: el
 *  catalogo no manda estas columnas, asi que Admin -> Productos sigue
 *  funcionando aunque todavia no hayas corrido el parche. */
export function piezaToDB(p: Omit<import("@/types").Product, "id">) {
  return {
    ...productToDB(p),
    visibilidad:    "privado",
    envio_costo:    p.envio_costo    ?? 0,
    cliente_nombre: p.cliente_nombre ?? null,
    cliente_email:  p.cliente_email  ?? null,
    consulta_id:    p.consulta_id    ?? null,
    vence_el:       p.vence_el       ?? null,
    detalle:        p.detalle        ?? null,
  };
}

/** El parche de piezas a pedido no esta corrido todavia. */
export function faltaParchePiezas(msg: string) {
  return /visibilidad|envio_costo|verificar_precios|get_pieza_por_token/i.test(msg);
}

/* Las columnas de marca, SKU y variantes son opcionales: sin los parches
   correspondientes no existen en la base y hay que mandar el payload sin
   ellas, para que el panel siga guardando en vez de tirar error. */
const EXTRAS = [
  "brand", "sku", "price_before", "genero", "sizes", "colors",
  "stock_variantes", "material", "composicion", "cuidados",
] as const;

export function sinExtras(payload: Record<string, unknown>) {
  const copia = { ...payload };
  for (const k of EXTRAS) delete copia[k];
  return copia;
}

export function faltaColumnaExtra(msg: string) {
  return new RegExp(EXTRAS.join("|"), "i").test(msg) && /(column|schema cache)/i.test(msg);
}

export function productToDB(p: Omit<import("@/types").Product, "id">) {
  return {
    title:        p.title,
    price:        p.price,
    cost_price:   p.cost_price   ?? 0,
    icon:         p.icon,
    image:        p.image        ?? null,
    images:       p.images       ?? null,
    category_id:  p.categoryId,
    subcategory:  p.subcategory  ?? null,
    brand:        p.brand        ?? null,
    sku:          p.sku          ?? null,
    description:  p.description  ?? null,
    stock:        p.stock        ?? 0,
    is_new:       p.isNew        ?? false,
    is_exclusive: p.isExclusive  ?? false,
    is_outlet:    p.isOutlet     ?? false,

    price_before:    p.price_before ?? null,
    genero:          p.genero       ?? null,
    sizes:           p.sizes        ?? null,
    colors:          p.colors       ?? null,
    stock_variantes: p.stock_variantes ?? null,
    material:        p.material     ?? null,
    composicion:     p.composicion  ?? null,
    cuidados:        p.cuidados     ?? null,
  };
}

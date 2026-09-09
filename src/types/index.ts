// src/types/index.ts

/** Un color de prenda: el nombre que ve el cliente y el color con el que se
 *  dibuja la muestra redonda. `hex` puede ser un color plano ("#1B1B1B") o un
 *  degradé CSS para los estampados y los jaspeados ("linear-gradient(...)"). */
export interface ColorVariante {
  name: string;
  hex: string;
}

/** El stock real vive por variante, no por producto: una remera puede tener
 *  12 en negro talle M y 0 en negro talle S. La clave es `TALLE|COLOR`
 *  —exactamente como la arma variantKey()— y el valor es el stock.
 *  Un producto sin talles ni colores (una gorra única, un perfume) no lleva
 *  este objeto y usa el `stock` suelto de siempre. */
export type StockVariantes = Record<string, number>;

/** La clave con la que se guarda el stock de una variante y con la que se
 *  identifica un renglón del carrito. Se centraliza acá para que el catálogo,
 *  el carrito, el checkout y el admin la armen todos igual. */
export function variantKey(talle?: string | null, color?: string | null): string {
  return `${talle ?? ""}|${color ?? ""}`;
}

export type Genero = "mujer" | "hombre" | "unisex" | "nina" | "nino" | "bebe";

export interface Product {
  id: string;
  title: string;
  price: number;
  price_before?: number; // precio anterior: se muestra tachado al lado del actual
  cost_price?: number;   // precio de costo interno — solo visible en Admin
  icon: string;
  image?: string;
  images?: string[];
  categoryId: string;
  subcategory?: string;
  slug?: string;         // su dirección propia: /producto/<slug>
  brand?: string;        // marca de la prenda (Levi's, Nike, Vans…)
  sku?: string;          // código interno con el que se busca en el depósito

  description?: string;
  stock?: number;
  isNew?: boolean;
  isExclusive?: boolean;
  isOutlet?: boolean;

  // ── Indumentaria y calzado ──────────────────────────────────────
  genero?:         Genero;
  sizes?:          string[];        // ["S","M","L"] o ["38","39","40"]
  colors?:         ColorVariante[];
  stock_variantes?: StockVariantes; // "M|Negro" → 4
  material?:       string;          // "Algodón 100%"
  composicion?:    string;          // etiqueta completa de composición
  cuidados?:       string;          // "Lavar a máquina con agua fría"
  guia_talles?:    string;          // id de la tabla de talles a mostrar

  // ── Producto por encargo ────────────────────────────────────────
  // Un producto que existe y se puede pagar, pero no sale en el catálogo:
  // se llega por un link privado con token. Ver
  // supabase/parches/pedidos-especiales.sql.
  visibilidad?:    "catalogo" | "privado";
  token?:          string;   // los 32 caracteres del link. Lo pone la base
  envio_costo?:    number;   // flete, separado del precio
  cliente_nombre?: string;
  cliente_email?:  string;
  consulta_id?:    string;   // de qué consulta salió
  vence_el?:       string;   // ISO. null = no vence
  detalle?:        string;   // texto que ve el cliente en el link
}

export interface SubCategory {
  name: string;
}

export interface Category {
  id: string;
  name: string;
  subCategories: string[];
}

export interface Especial {
  id: string;
  name: string;
}

/** Un renglón del carrito. Dos remeras iguales en talles distintos son DOS
 *  renglones, no uno con cantidad 2: por eso el renglón se identifica por
 *  `lineId` (producto + talle + color) y no por el id del producto. */
export interface CartItem {
  product: Product;
  quantity: number;
  size?:  string;
  color?: string;
  lineId: string;
}

/** El identificador del renglón. Mismo criterio en todos lados. */
export function lineIdDe(productId: string, size?: string, color?: string): string {
  return `${productId}::${variantKey(size, color)}`;
}

export type ConsultaEstado =
  | "nueva" | "en_proceso" | "cotizada" | "cerrada" | "perdida";

/** Una consulta: el cliente busca algo que no está en el catálogo, o un talle
 *  o un color que no aparece disponible. Es la puerta de entrada de los
 *  pedidos especiales. */
export interface Consulta {
  id:         string;
  numero:     string;
  created_at: string;

  producto_buscado: string;
  marca_buscada?:   string | null;
  talle_buscado?:   string | null;
  color_buscado?:   string | null;
  referencia?:      string | null;  // link o código de la prenda vista en otro lado
  codigo?:          string | null;  // SKU si el cliente lo tiene
  fotos?:           string[] | null;

  nombre:              string;
  email:               string;
  whatsapp?:           string | null;
  contacto_preferido:  "email" | "whatsapp";
  user_id?:            string | null;

  estado:           ConsultaEstado;
  precio_cotizado?: number | null;
  plazo_estimado?:  string | null;
  notas_internas?:  string | null;
}

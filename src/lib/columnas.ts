// src/lib/columnas.ts
//
// Las columnas que se le piden a la tabla `products`, en un solo lugar.
//
// POR QUÉ NO SE USA select("*"): la tabla tiene `cost_price`, que es el precio
// de costo. Con un asterisco viajaría al navegador en cada listado público.
// Se piden las columnas una por una a propósito.
//
// POR QUÉ HAY DOS LISTAS: las columnas de indumentaria (talles, colores,
// stock por variante) las agrega supabase/parches/indumentaria.sql. Si todavía
// no se corrió, pedirlas hace fallar la consulta entera y la tienda queda vacía
// (en la consola del navegador se ven esos intentos como un 400 de Supabase).
// Entonces se intenta con la lista completa y, si la base se queja de una
// columna que no existe, se reintenta con la lista básica. La tienda funciona
// igual —sin selector de talle— y el día que se corre el parche empieza a
// traerlas sola, sin tocar código.

const BASE =
  "id, title, price, icon, image, images, category_id, subcategory, brand, sku, " +
  "description, stock, is_new, is_exclusive, is_outlet, created_at, updated_at, slug";

const VARIANTES =
  "price_before, genero, sizes, colors, stock_variantes, material, composicion, cuidados";

export const COLUMNAS_BASE = BASE;
export const COLUMNAS_COMPLETAS = `${BASE}, ${VARIANTES}`;

/** ¿El error es "esa columna no existe"? */
export function faltanColumnasDeVariantes(msg?: string | null): boolean {
  if (!msg) return false;
  return /column .* does not exist|schema cache/i.test(msg);
}

type Consulta<T> = { data: T | null; error: { message: string } | null };

/** Corre la consulta con todas las columnas y, si la base no las tiene
 *  todavía, la repite con las básicas. `armar` recibe la lista de columnas y
 *  devuelve la consulta ya construida. */
export async function conColumnas<T>(
  armar: (columnas: string) => PromiseLike<Consulta<T>>,
): Promise<Consulta<T>> {
  const completo = await armar(COLUMNAS_COMPLETAS);
  if (!completo.error) return completo;
  if (!faltanColumnasDeVariantes(completo.error.message)) return completo;
  return armar(COLUMNAS_BASE);
}

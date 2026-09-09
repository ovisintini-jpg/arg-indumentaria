// src/lib/subir-fotos.ts
//
// Lo compartido entre Admin → Repuestos y Admin → A pedido para subir fotos al
// bucket "products".
//
// POR QUÉ EXISTE ESTE ARCHIVO — el bug del 05/09/2026:
// Las dos pantallas armaban la clave del archivo así:
//
//     const ext = file.name.split(".").pop();
//     const nombre = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
//
// El problema es que `ext` sale del nombre que le puso el celular o la cámara,
// sin mirarlo. Con "foto.jpg" no pasa nada. Pero:
//
//   · "captura de pantalla.PNG"  → la clave termina en ".PNG"
//   · "recibo (1)"  (sin punto)  → split(".").pop() devuelve el NOMBRE ENTERO,
//                                   así que la clave termina en ".recibo (1)"
//                                   — con espacios y paréntesis adentro
//   · "diseño.jpeg "             → ".jpeg " con el espacio del final
//
// Supabase Storage rechaza esas claves y devuelve un error genérico. Como el
// nombre del archivo lo elige el usuario y no el código, el bug aparecía sólo
// con ciertas fotos: por eso parecía que "Repuestos anda y A pedido no", cuando
// en realidad las dos pantallas tenían el mismo problema latente.
//
// La foto que estés subiendo no debería poder romper la subida. Estas dos
// funciones son lo que garantiza eso.

/**
 * Arma una clave segura para el bucket. Del nombre original NO se conserva
 * nada más que la extensión, y sólo si es una extensión creíble: letras y
 * números, hasta 5 caracteres. Si no lo es, el archivo se sube sin extensión
 * (Supabase igual lo sirve bien: el tipo lo define el Content-Type).
 */
export function claveDeArchivo(file: File): string {
  const partes = file.name.split(".");
  const cruda  = partes.length > 1 ? partes.pop()! : "";
  const ext    = cruda.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5);
  const base   = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return ext ? `${base}.${ext}` : base;
}

const MB = (n: number) => `${(n / 1_048_576).toFixed(1)} MB`;

/**
 * Los errores del storage de Supabase vienen en inglés y no dicen qué hacer.
 * Esto los convierte en una instrucción, sin esconder el original: si no
 * reconocemos el error, se muestra tal cual vino.
 */
export function traducirErrorDeSubida(msg: string, file: File): string {
  if (/exceeded the maximum allowed size|payload too large|413/i.test(msg)) {
    return `pesa ${MB(file.size)} y el bucket no la acepta. Achicala, o subí el límite en Supabase → Storage → products → Settings.`;
  }
  if (/mime type|not supported|invalid_mime/i.test(msg)) {
    return `el bucket no acepta archivos ${file.type || "de ese tipo"}. Revisá los "Allowed MIME types" del bucket products.`;
  }
  if (/invalid key|invalid_key|key.*invalid/i.test(msg)) {
    return `el nombre del archivo no le gustó a Supabase. Renombralo a algo simple (letras, números y un punto) y probá de nuevo.`;
  }
  if (/row-level security|violates|unauthorized|403/i.test(msg)) {
    return 'tu usuario no figura como admin para el storage. Revisá la policy "Admins suben imágenes" o corré supabase/crear-admin.sql.';
  }
  if (/bucket not found|404/i.test(msg)) {
    return 'no existe el bucket "products" en Supabase → Storage.';
  }
  if (/duplicate|already exists/i.test(msg)) {
    return "ya hay un archivo con ese nombre. Volvé a intentar.";
  }
  return msg;
}

// src/lib/supabase-server.ts
//
// Cliente de Supabase para leer del lado del SERVIDOR: las páginas de
// repuesto y de rubro, y el sitemap.
//
// Por qué existe aparte de src/lib/supabase.ts: ese es un createBrowserClient
// y guarda la sesión en cookies — sirve para la tienda y el panel, no para
// renderizar en el servidor. Este usa la clave anon y no guarda sesión: pide
// los datos como un visitante cualquiera.
//
// Que use la clave anon no es una limitación, es lo que queremos: la RLS se
// aplica igual, así que una pieza a pedido (visibilidad = 'privado') no puede
// salir por acá ni por error. El día que alguien agregue una página pública
// nueva, hereda esa garantía sin tener que acordarse de nada.

import { createClient } from "@supabase/supabase-js";

const URL_SUPABASE  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const CLAVE_ANON    = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseServidorConfigurado = Boolean(URL_SUPABASE && CLAVE_ANON);

export function supabaseServidor() {
  return createClient(
    URL_SUPABASE  || "http://localhost:54321",
    CLAVE_ANON    || "sin-configurar",
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

/**
 * La dirección pública del sitio, para armar URLs absolutas (sitemap, robots,
 * Open Graph, JSON-LD).
 *
 * El orden importa: si NEXT_PUBLIC_SITE_URL no está cargada y el sitio corre
 * en Vercel, usamos el dominio del deploy en vez de inventar uno. Antes esto
 * caía siempre en el dominio propio aunque el sitio no estuviera ahí todavía,
 * y un sitemap que declara URLs de otro dominio Google lo descarta entero.
 */
export function urlDelSitio(): string {
  const explicita = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicita) return explicita.replace(/\/$/, "");

  const vercel =
    process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;

  return "https://www.argindumentaria.com.ar";
}

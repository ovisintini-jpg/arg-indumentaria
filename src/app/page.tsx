// app/page.tsx
//
// La home: buscador + grilla del catálogo (StoreView) y nada más a la vista.
//
// El 08/09 se sacó de acá el bloque <LinksCatalogo /> —el índice de todos los
// repuestos agrupados por rubro que iba justo antes del Footer—: repetía el
// catálogo que ya está arriba. El componente sigue existiendo en
// src/components/LinksCatalogo.tsx por si conviene montarlo en otro lado.
//
// Lo único que se agregó a cambio es INVISIBLE para el visitante: la ficha
// del negocio en JSON-LD. No dibuja nada, no ocupa alto; es la explicación
// que lee Google de qué es este sitio, quién lo atiende y a dónde vende.
export const revalidate = 300;

import Header from "@/components/Header";
import StoreView from "@/components/StoreView";
import Footer from "@/components/Footer";
import { supabaseServidor, supabaseServidorConfigurado } from "@/lib/supabase-server";
import { jsonLdOrganizacion, jsonLdSitio, ldJson } from "@/lib/seo";

/** Los datos de contacto salen de la misma fila que usa el pie de página, así
 *  el día que Omar los cargue de verdad desde Admin → Configuración, los
 *  datos estructurados se actualizan solos. Si la consulta falla, la ficha
 *  sale igual sin contacto: es preferible a que la home se caiga. */
async function traerContacto() {
  if (!supabaseServidorConfigurado) return {};
  try {
    const { data } = await supabaseServidor()
      .from("site_settings")
      .select("email, phone, instagram, facebook")
      .maybeSingle();

    if (!data) return {};
    return {
      email: data.email as string | undefined,
      telefono: data.phone as string | undefined,
      instagram: data.instagram as string | undefined,
      facebook: data.facebook as string | undefined,
    };
  } catch {
    return {};
  }
}

export default async function Home() {
  const contacto = await traerContacto();

  return (
    <div className="flex min-h-screen flex-col bg-ink text-chalk">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: ldJson([jsonLdOrganizacion(contacto), jsonLdSitio()]),
        }}
      />
      <Header />
      <main className="flex-1">
        <StoreView />
      </main>
      <Footer />
    </div>
  );
}

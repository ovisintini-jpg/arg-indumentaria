import type { Metadata, Viewport } from "next";
import { Archivo, Inter, Barlow_Condensed, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/context/CartContext";
import { CategoryProvider } from "@/context/CategoryContext";
import { ProductsProvider } from "@/context/ProductsContext";
import { UserProvider } from "@/context/UserContext";
import { CatalogCategoriesProvider } from "@/context/CatalogCategoriesContext";
import CartPanel from "@/components/CartPanel";
import QuoteModal from "@/components/QuoteModal";
import { QuoteProvider } from "@/context/QuoteContext";
import { urlDelSitio } from "@/lib/supabase-server";
import { NOMBRE_SITIO, ogImagenAbsoluta } from "@/lib/seo";
import { traerCatalogoServidor } from "@/lib/catalogo-servidor";

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  weight: ["500", "600", "700", "800", "900"],
});

// Inter reemplaza a Barlow como letra de lectura. Barlow es una grotesca
// deportiva —nació para carteles de ruta— y sobre papel claro tiraba a
// "taller". Inter es la que usan casi todas las tiendas de indumentaria:
// neutra, con números tabulares y muy afinada en tamaños chicos, que es
// donde vive el 80 % de esta tienda (precios, talles, descripciones).
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["300", "400", "500", "600", "700"],
});

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  variable: "--font-barlow-cond",
  weight: ["400", "500", "600"],
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-plex-mono",
  weight: ["400", "500"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  /* Sin `maximumScale: 1`: bloquear el zoom deja afuera a cualquiera que
     necesite agrandar la letra, y no hacía falta —el zoom molesto de iPhone
     al tocar un campo se arregla poniendo los campos en 16 px, que es lo que
     hace la regla del final de globals.css. */
  themeColor: "#FFFFFF",
};

// Las etiquetas que comparten TODAS las páginas. Cada página con
// generateMetadata (la ficha, el rubro) pisa el título y la descripción; lo
// que se define acá es el piso del que parten.
export const metadata: Metadata = {
  // ⚠️ metadataBase NO es decorativo. Sin él, Next resuelve las direcciones
  // relativas de openGraph contra "localhost:3000" y las manda así al
  // mundo: el link compartido apunta a una máquina que no existe y la
  // vista previa sale vacía. Con esto puesto, el resto del archivo puede
  // escribir rutas relativas tranquilo.
  metadataBase: new URL(urlDelSitio()),

  title: {
    default: "ARG Indumentaria | Ropa y calzado para toda la familia",
    // Cada página pone lo suyo y esto le pega la marca al final, así no hay
    // que repetir " — ARG Indumentaria" a mano en cada archivo.
    template: "%s | ARG Indumentaria",
  },
  description:
    "Indumentaria y calzado para mujer, hombre y chicos. Marcas, temporada y outlet en un solo lugar: remeras, jeans, camperas, vestidos, zapatillas y botas. Envíos a todo el país, cambios sin cargo y hasta 6 cuotas sin interés.",

  applicationName: NOMBRE_SITIO,
  authors: [{ name: NOMBRE_SITIO }],
  creator: NOMBRE_SITIO,
  publisher: NOMBRE_SITIO,

  // Sin esto Google elige solo cuánto texto mostrar y si muestra la foto.
  // "max-image-preview: large" es lo que hace que en el celular aparezca la
  // imagen grande al lado del resultado, que es la diferencia entre que te
  // toquen y que sigan de largo.
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },

  // Lo que se ve al pegar el link en WhatsApp, Instagram o Facebook. En
  // Argentina un catálogo de ropa se comparte por WhatsApp mucho antes que por
  // cualquier otro lado: hasta ahora el link salía como texto pelado.
  openGraph: {
    type: "website",
    locale: "es_AR",
    siteName: NOMBRE_SITIO,
    title: "ARG Indumentaria | Ropa y calzado para toda la familia",
    description:
      "Ropa y calzado para mujer, hombre y chicos. Temporada y outlet, envíos a todo el país y cambios sin cargo.",
    url: urlDelSitio(),
    images: ogImagenAbsoluta(),
  },

  twitter: {
    card: "summary_large_image",
    title: "ARG Indumentaria | Ropa y calzado para toda la familia",
    description:
      "Ropa y calzado para mujer, hombre y chicos. Temporada y outlet, envíos a todo el país.",
    images: ogImagenAbsoluta().map((i) => i.url),
  },

  alternates: { canonical: urlDelSitio() },

  // NOTA: acá había una lista de `keywords`. Se sacó a propósito — Google
  // ignora esa etiqueta desde 2009 y no mueve el ranking ni un milímetro.
  // Lo que sí decide por qué palabras te encuentran es el TEXTO de la
  // página: el título de cada prenda, la descripción y el nombre de
  // la categoría. Ahí es donde hay que trabajar, no en una lista escondida.

  formatDetection: { telephone: false, address: false, email: false },
};

// El layout pasa a ser async para poder leer el catálogo antes de dibujar.
// Cuesta una consulta a Supabase por render, y a cambio la home —y cualquier
// página que use los contextos— sale con el contenido ya escrito en el HTML
// en vez de armarse recién en el navegador.
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { productos, rubros, especiales } = await traerCatalogoServidor();

  return (
    <html
      lang="es"
      className={`${archivo.variable} ${inter.variable} ${barlowCondensed.variable} ${plexMono.variable} min-h-screen`}
    >
      <body className="min-h-screen bg-ink text-chalk antialiased">
        <UserProvider>
          <CatalogCategoriesProvider
            initialCategories={rubros}
            initialEspeciales={especiales}
          >
            <ProductsProvider initialProducts={productos}>
              <CategoryProvider>
                <CartProvider>
                  <QuoteProvider>
                    {children}
                    <CartPanel />
                    <QuoteModal />
                  </QuoteProvider>
                </CartProvider>
              </CategoryProvider>
            </ProductsProvider>
          </CatalogCategoriesProvider>
        </UserProvider>
      </body>
    </html>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import LegalModal from "@/components/LegalModal";
import Brand from "@/components/Brand";
import { useQuote } from "@/context/QuoteContext";
import { Icon } from "@/components/Icons";

interface SiteSettings {
  site_name: string;
  email: string;
  phone: string;
  whatsapp: string;
  instagram: string;
  facebook: string;
  envios_desc: string;
}

const defaults: SiteSettings = {
  site_name: "ARG Indumentaria",
  email: "ventas@argindumentaria.com.ar",
  phone: "+54 9 351 000-0000",
  whatsapp: "+54 9 351 000-0000",
  instagram: "@arg.indumentaria",
  facebook: "argindumentaria",
  envios_desc: "Envíos a todo el país por Correo Argentino, OCA y Andreani",
};

/* Todos los links del pie van a páginas o secciones QUE EXISTEN. En la versión
   anterior había tres ("Envíos y plazos", "Cambios y garantía", "Cómo leer un
   OEM") que apuntaban a un bloque del hero que no explicaba nada de eso: el
   cliente hacía click esperando una respuesta y terminaba arriba de todo.
   Mientras esas páginas no estén escritas, esos temas viven en la ficha de
   producto (el acordeón) y en la guía de talles, y para allá mandan. */
const COLS = [
  {
    h: "Comprar",
    links: [
      { t: "Mujer",    href: "/categoria/mujer" },
      { t: "Hombre",   href: "/categoria/hombre" },
      { t: "Chicos",   href: "/categoria/ninas" },
      { t: "Calzado",  href: "/categoria/calzado-mujer" },
      { t: "Outlet",   href: "/categoria/outlet" },
    ],
  },
  {
    h: "Ayuda",
    links: [
      { t: "Guía de talles",        href: "/#guia-de-talles" },
      { t: "Cambios y devoluciones", href: "/arrepentimiento" },
      { t: "Todo el catálogo",       href: "/categoria/todos" },
    ],
  },
];

export default function Footer() {
  const [settings, setSettings] = useState<SiteSettings>(defaults);
  const [legalOpen, setLegalOpen] = useState(false);
  const { abrirCotizador } = useQuote();

  useEffect(() => {
    supabase
      .from("site_settings")
      .select("site_name,email,phone,whatsapp,instagram,facebook,envios_desc")
      .eq("id", 1)
      .single()
      .then(({ data }) => {
        if (data) setSettings(data as SiteSettings);
      });
  }, []);

  const waNumber = settings.whatsapp.replace(/\D/g, "");
  const link = "text-[0.93rem] text-mute transition-colors hover:text-chalk";

  return (
    <footer className="border-t border-line bg-panel">
      <div className="mx-auto w-full max-w-[1320px] px-4 pt-12 md:px-6 md:pt-16 lg:px-14">
        <div className="grid grid-cols-2 gap-x-5 gap-y-10 pb-10 md:gap-12 lg:grid-cols-[1.4fr_repeat(4,minmax(0,1fr))]">

          <div className="col-span-2 md:col-span-1">
            <Brand />
            <p className="mt-4 max-w-[34ch] text-[0.93rem] text-mute">
              Indumentaria y calzado para toda la familia. Temporada, básicos y
              outlet.
            </p>
            <p className="mt-3 max-w-[34ch] text-[0.93rem] text-dim">
              {settings.envios_desc}
            </p>
          </div>

          {COLS.map((col) => (
            <div key={col.h} className="min-w-0">
              <h4 className="ag-eyebrow mb-4 !text-chalk">{col.h}</h4>
              <ul className="flex flex-col gap-2.5">
                {col.links.map((l) => (
                  <li key={l.t}>
                    <Link href={l.href} className={link}>{l.t}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="col-span-2 md:col-span-1">
            <h4 className="ag-eyebrow mb-4 !text-chalk">¿No está tu talle?</h4>
            <p className="mb-4 text-[0.88rem] leading-relaxed text-mute">
              Si no encontrás la prenda o tu talle está agotado, lo buscamos y te
              pasamos precio y plazo.
            </p>
            <button type="button" onClick={() => abrirCotizador()} className="ag-btn ag-btn-solid ag-btn-sm">
              Pedir por encargo
            </button>
          </div>

          <div className="col-span-2 md:col-span-1">
            <h4 className="ag-eyebrow mb-4 !text-chalk">Contacto</h4>
            <ul className="flex flex-col gap-2.5">
              <li><a href={`mailto:${settings.email}`} className={link}>{settings.email}</a></li>
              <li>
                <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noopener noreferrer" className={link}>
                  WhatsApp {settings.whatsapp}
                </a>
              </li>
              <li>
                <a
                  href={`https://www.instagram.com/${settings.instagram.replace("@", "")}`}
                  target="_blank" rel="noopener noreferrer" className={link}
                >
                  {settings.instagram}
                </a>
              </li>
              <li>
                <a
                  href="https://www.argentina.gob.ar/produccion/defensadelconsumidor/formulario"
                  target="_blank" rel="noopener noreferrer" className={link}
                >
                  Defensa del Consumidor
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Medios de pago y envío. En una tienda argentina esto no es adorno:
            es la respuesta a "¿puedo pagar en cuotas?" y a "¿me llega?". */}
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-line py-6 text-[0.85rem] text-mute">
          <span className="inline-flex items-center gap-2"><Icon name="escudo" size={17} /> Mercado Pago · Visa · Mastercard · American Express</span>
          <span className="inline-flex items-center gap-2"><Icon name="truck" size={17} /> Correo Argentino · OCA · Andreani</span>
        </div>

        {/* Botón de arrepentimiento — Resolución 424/2020.
            Tiene que estar en un lugar destacado en visibilidad y tamaño, con
            acceso directo desde la home y sin pedir registro. Por eso va acá
            con su propio recuadro y no como un link más de la lista. */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line py-6 md:py-7">
          <Link
            href="/arrepentimiento"
            className="inline-flex items-center gap-3 border border-chalk px-5 py-3.5 font-display text-[0.86rem] font-bold uppercase tracking-[0.14em] text-chalk transition-colors hover:bg-chalk hover:text-white"
          >
            Botón de arrepentimiento
          </Link>
          <p className="max-w-[46ch] text-[0.82rem] leading-relaxed text-dim">
            Podés revocar tu compra dentro de los 10 días corridos de recibida la prenda.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3.5 border-t border-line py-6 text-[0.82rem] text-dim">
          <span>© {new Date().getFullYear()} {settings.site_name} · Argentina</span>
          <button
            type="button"
            onClick={() => setLegalOpen(true)}
            className="transition-colors hover:text-chalk"
          >
            Términos y condiciones
          </button>
        </div>
      </div>

      <div className="ag-rail" />
      <LegalModal isOpen={legalOpen} onClose={() => setLegalOpen(false)} />
    </footer>
  );
}

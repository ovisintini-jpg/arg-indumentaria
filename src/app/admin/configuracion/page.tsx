"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
  Page, PageHead, Panel, Btn, Field, Input, Select, Loading, Msg, Note,
  ErrorState, SIN_RESPUESTA,
} from "@/components/admin/ui";

interface SiteSettings {
  siteName: string; bannerText: string; email: string; phone: string;
  whatsapp: string; instagram: string; facebook: string;
  enviosDesc: string; freeShippingMin: string; currency: string;
}

const DEFAULT: SiteSettings = {
  siteName:   "ARG INDUMENTARIA",
  bannerText: "INDUMENTARIA . CALZADO . ACCESORIOS",
  email:      "ventas@argindumentaria.com.ar",
  phone:      "+54 9 351 000-0000",
  whatsapp:   "+54 9 351 000-0000",
  instagram:  "@arg.indumentaria",
  facebook:   "argindumentaria",
  enviosDesc: "Envíos a todo el país por Correo Argentino, OCA y Andreani",
  freeShippingMin: "50000",
  currency:   "ARS",
};

export default function ConfiguracionPage() {
  const [cfg, setCfg]         = useState<SiteSettings>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState("");
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const t = setTimeout(() => { setLoading(false); setLoadError(SIN_RESPUESTA); }, 10000);

    const fetchSettings = async () => {
      try {
        const { data, error: err } = await supabase.from("site_settings").select("*").eq("id", 1).single();
        if (err) setLoadError(err.message);
        if (!err && data) {
          setCfg({
            siteName:        data.site_name   ?? DEFAULT.siteName,
            bannerText:      data.banner_text ?? DEFAULT.bannerText,
            email:           data.email       ?? DEFAULT.email,
            phone:           data.phone       ?? DEFAULT.phone,
            whatsapp:        data.whatsapp    ?? DEFAULT.whatsapp,
            instagram:       data.instagram   ?? DEFAULT.instagram,
            facebook:        data.facebook    ?? DEFAULT.facebook,
            enviosDesc:      data.envios_desc ?? DEFAULT.enviosDesc,
            freeShippingMin: String(data.free_shipping_min ?? DEFAULT.freeShippingMin),
            currency:        data.currency    ?? DEFAULT.currency,
          });
        }
      } catch {
        setLoadError(SIN_RESPUESTA);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings().finally(() => clearTimeout(t));
    return () => clearTimeout(t);
  }, []);

  const set = (key: keyof SiteSettings) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setCfg((c) => ({ ...c, [key]: e.target.value }));

  const save = async () => {
    setError(""); setSaving(true);
    const { error: err } = await supabase.from("site_settings").update({
      site_name:   cfg.siteName,
      banner_text: cfg.bannerText,
      email:       cfg.email,
      phone:       cfg.phone,
      whatsapp:    cfg.whatsapp,
      instagram:   cfg.instagram,
      facebook:    cfg.facebook,
      envios_desc: cfg.enviosDesc,
      free_shipping_min: parseFloat(cfg.freeShippingMin) || 0,
      currency:    cfg.currency,
    }).eq("id", 1);
    setSaving(false);

    if (err) setError("No se pudo guardar. Revisá que tu usuario tenga permisos de admin.");
    else { setSaved(true); setTimeout(() => setSaved(false), 2500); }
  };

  if (loading || loadError) {
    return (
      <Page>
        <PageHead title="Configuración" />
        <div className="border border-line bg-panel">
          {loading ? <Loading label="Cargando configuración" /> : <ErrorState msg={loadError} />}
        </div>
      </Page>
    );
  }

  return (
    <Page>
      <PageHead
        title="Configuración"
        sub="Lo que la tienda muestra en el pie, el banner y los datos de contacto."
        action={
          <Btn variant="acento" size="md" onClick={save} disabled={saving}>
            {saving ? "Guardando…" : "Guardar"}
          </Btn>
        }
      />

      <div className="max-w-4xl space-y-6">

        <Panel title="Identidad">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field label="Nombre del sitio">
              <Input value={cfg.siteName} onChange={set("siteName")} />
            </Field>
            <Field label="Texto del banner" hint="La línea corta que acompaña al logo">
              <Input value={cfg.bannerText} onChange={set("bannerText")} />
            </Field>
          </div>
        </Panel>

        <Panel title="Contacto">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field label="Email de ventas">
              <Input type="email" value={cfg.email} onChange={set("email")} />
            </Field>
            <Field label="Teléfono">
              <Input value={cfg.phone} onChange={set("phone")} />
            </Field>
            <Field label="WhatsApp" hint="Con característica; el link se arma solo">
              <Input value={cfg.whatsapp} onChange={set("whatsapp")} />
            </Field>
          </div>
        </Panel>

        <Panel title="Redes">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field label="Instagram">
              <Input value={cfg.instagram} onChange={set("instagram")} />
            </Field>
            <Field label="Facebook">
              <Input value={cfg.facebook} onChange={set("facebook")} />
            </Field>
          </div>
        </Panel>

        <Panel title="Envíos y precios">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field label="Cómo se envía" span hint="Aparece en el pie y en el checkout">
              <Input value={cfg.enviosDesc} onChange={set("enviosDesc")} />
            </Field>
            <Field label="Envío gratis desde (ARS)" hint="0 desactiva el envío gratis">
              <Input type="number" min={0} value={cfg.freeShippingMin} onChange={set("freeShippingMin")} />
            </Field>
            <Field label="Moneda">
              <Select value={cfg.currency} onChange={set("currency")}>
                <option value="ARS">ARS — Peso argentino</option>
                <option value="USD">USD — Dólar</option>
              </Select>
            </Field>
          </div>
        </Panel>

        <div className="border border-warn/30 bg-warn/5 p-6">
          <p className="ag-eyebrow mb-3 text-warn">Todavía se editan a mano</p>
          <ul className="space-y-2 font-light leading-relaxed text-mute">
            <li>
              <span className="text-chalk">Alias y CBU</span> de la transferencia: están escritos
              en <code className="ag-mono text-mute">src/app/checkout/page.tsx</code>.
            </li>
            <li>
              <span className="text-chalk">Razón social, CUIT y domicilio</span> de los Términos y
              Condiciones: los tramos marcados <code className="ag-mono text-mute">[REMPLAZAR: …]</code> en
              <code className="ag-mono text-mute"> src/components/LegalModal.tsx</code>.
            </li>
            <li>
              <span className="text-chalk">Emails de pedido</span>: necesitan
              <code className="ag-mono text-mute"> RESEND_API_KEY</code> y un dominio verificado en Resend.
            </li>
          </ul>
        </div>

        <div className="flex flex-wrap items-center gap-4 border-t border-line pt-6">
          <Btn variant="acento" size="md" onClick={save} disabled={saving}>
            {saving ? "Guardando…" : "Guardar configuración"}
          </Btn>
          {saved && <Msg tone="ok">Guardado</Msg>}
          {error && <Msg tone="sale">{error}</Msg>}
        </div>
      </div>

      <Note>Los cambios se ven en la tienda apenas se recarga la página</Note>
    </Page>
  );
}

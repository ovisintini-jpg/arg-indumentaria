import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

// Botón de arrepentimiento (Res. 424/2020, art. 2):
// "dentro de las VEINTICUATRO (24) horas y por el mismo medio, deberá
//  informar al consumidor el número de código de identificación de
//  arrepentimiento".
//
// Acá eso se cumple al instante: se le muestra el código en pantalla y se le
// manda el acuse por mail. Si Resend no está configurado, el código igual se
// mostró en pantalla y la solicitud quedó en /admin — pero conviene
// configurarlo, porque el acuse por escrito es la prueba de que cumpliste.

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

const FROM_EMAIL  = process.env.RESEND_FROM_EMAIL || "ARG Indumentaria <onboarding@resend.dev>";
const OWNER_EMAIL = process.env.RESEND_OWNER_EMAIL;

interface Payload {
  codigo?:    string;
  nombre?:    string;
  email?:     string;
  telefono?:  string;
  documento?: string;
  pedido?:    string;
  fecha?:     string;
  producto?:  string;
  motivo?:    string;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function fila(etiqueta: string, valor?: string) {
  if (!valor) return "";
  return `
    <tr>
      <td style="padding:7px 14px 7px 0;color:#8C939E;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;vertical-align:top;white-space:nowrap;">${escapeHtml(etiqueta)}</td>
      <td style="padding:7px 0;color:#F3F5F8;font-size:15px;vertical-align:top;">${escapeHtml(valor)}</td>
    </tr>`;
}

// ── Aviso interno ────────────────────────────────────────────────
function emailInterno(p: Payload) {
  return `
  <div style="background:#0A0B0D;padding:32px 16px;font-family:Helvetica,Arial,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#101317;border:1px solid #232830;">
      <div style="height:3px;background:#E0A32E;"></div>
      <div style="padding:28px 32px;">
        <p style="color:#8C939E;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;margin:0 0 6px 0;">Botón de arrepentimiento</p>
        <h1 style="color:#E0A32E;font-size:22px;letter-spacing:0.05em;margin:0 0 8px 0;">${escapeHtml(p.codigo ?? "")}</h1>
        <p style="color:#F3F5F8;font-size:15px;margin:0 0 22px 0;">
          Tenés 24 horas para confirmarle el código por escrito y coordinar el retiro.
          Los gastos de devolución van por cuenta de la casa.
        </p>

        <table style="width:100%;border-collapse:collapse;">
          ${fila("Cliente", p.nombre)}
          ${fila("Email", p.email)}
          ${fila("Teléfono", p.telefono)}
          ${fila("DNI / CUIT", p.documento)}
        </table>

        <div style="margin-top:22px;padding-top:18px;border-top:1px solid #232830;">
          <table style="width:100%;border-collapse:collapse;">
            ${fila("Pedido", p.pedido)}
            ${fila("Fecha de compra", p.fecha)}
            ${fila("Pieza", p.producto)}
            ${fila("Motivo", p.motivo)}
          </table>
        </div>
      </div>
      <div style="padding:14px 32px;border-top:1px solid #232830;">
        <p style="color:#5B626C;font-size:12px;margin:0;">Gestionalo desde el panel: /admin</p>
      </div>
    </div>
  </div>`;
}

// ── Acuse al cliente (lo que exige la norma) ─────────────────────
function emailCliente(p: Payload) {
  return `
  <div style="background:#0A0B0D;padding:32px 16px;font-family:Helvetica,Arial,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#101317;border:1px solid #232830;">
      <div style="height:3px;background:#1668D6;"></div>
      <div style="padding:28px 32px;">
        <p style="color:#8C939E;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;margin:0 0 6px 0;">Solicitud de revocación recibida</p>
        <h1 style="color:#3D8BF0;font-size:22px;letter-spacing:0.05em;margin:0 0 18px 0;">${escapeHtml(p.codigo ?? "")}</h1>

        <p style="color:#F3F5F8;font-size:15px;line-height:1.6;margin:0 0 14px 0;">
          ${escapeHtml(p.nombre ?? "Hola")}: registramos tu pedido de revocación de compra.
          Este es el código de identificación del trámite. Guardalo.
        </p>
        <p style="color:#8C939E;font-size:15px;line-height:1.6;margin:0 0 14px 0;">
          Dentro de las próximas 24 horas te escribimos para coordinar el retiro de la pieza.
          El costo del envío de vuelta corre por nuestra cuenta y el reintegro se hace por el
          mismo medio con el que pagaste, sin ninguna penalidad.
        </p>
        <p style="color:#8C939E;font-size:15px;line-height:1.6;margin:0;">
          Sólo te pedimos que la pieza vuelva sin instalar y en su embalaje original.
        </p>

        ${p.producto ? `<div style="margin-top:22px;padding-top:18px;border-top:1px solid #232830;">
          <table style="width:100%;border-collapse:collapse;">
            ${fila("Pieza", p.producto)}
            ${fila("Pedido", p.pedido)}
          </table>
        </div>` : ""}
      </div>
      <div style="padding:14px 32px;border-top:1px solid #232830;">
        <p style="color:#5B626C;font-size:12px;margin:0;">
          ARG Indumentaria · Art. 34 Ley 24.240 y Resolución 424/2020
        </p>
      </div>
    </div>
  </div>`;
}

export async function POST(req: NextRequest) {
  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_payload" }, { status: 400 });
  }

  if (!process.env.RESEND_API_KEY) {
    console.warn(
      `[arrepentimiento] ${payload.codigo ?? "sin código"} recibido de ${payload.email ?? "?"}. ` +
      "Falta RESEND_API_KEY: no salió ni el aviso interno ni el acuse al cliente. " +
      "El acuse por escrito dentro de las 24 h es obligatorio — configuralo."
    );
    return NextResponse.json({ ok: true, avisado: false });
  }

  const resend = getResend();

  // El acuse al cliente es lo obligatorio: va primero.
  let acusado = false;
  if (payload.email) {
    try {
      await resend.emails.send({
        from:    FROM_EMAIL,
        to:      payload.email,
        subject: `Tu solicitud de revocación — ${payload.codigo ?? ""}`,
        html:    emailCliente(payload),
      });
      acusado = true;
    } catch (err) {
      console.error("[arrepentimiento] no se pudo mandar el acuse al cliente:", err);
    }
  }

  let avisado = false;
  if (OWNER_EMAIL) {
    try {
      await resend.emails.send({
        from:    FROM_EMAIL,
        to:      OWNER_EMAIL,
        replyTo: payload.email,
        subject: `ARREPENTIMIENTO ${payload.codigo ?? ""} — ${payload.nombre ?? "cliente"}`,
        html:    emailInterno(payload),
      });
      avisado = true;
    } catch (err) {
      console.error("[arrepentimiento] no se pudo mandar el aviso interno:", err);
    }
  }

  return NextResponse.json({ ok: true, acusado, avisado });
}

import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

// Aviso interno cuando entra un pedido por encargo.
//
// La consulta YA quedó guardada en la base antes de llegar acá — esto es sólo
// el aviso. Si Resend no está configurado, se anota en el log del server y
// listo: nunca se pierde una consulta por un problema de email.

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

const FROM_EMAIL  = process.env.RESEND_FROM_EMAIL || "ARG Indumentaria <onboarding@resend.dev>";
const OWNER_EMAIL = process.env.RESEND_OWNER_EMAIL;

// Los mismos campos que manda QuoteModal después de guardar la consulta.
// Si acá se cambia un nombre, hay que cambiarlo también allá: el aviso llega
// vacío sin dar ningún error, que es la peor forma de romperse.
interface Payload {
  numero?:     string;
  producto?:   string;   // qué prenda busca
  detalle?:    string;   // marca · talle · color, ya armado
  referencia?: string;   // un link o una descripción de dónde la vio
  sku?:        string;
  nombre?:     string;
  email?:      string;
  whatsapp?:   string;
  fotos?:      string[];
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

function emailHtml(p: Payload) {
  const fotos = (p.fotos ?? []).length
    ? `<p style="margin:20px 0 8px 0;color:#8C939E;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;">Fotos adjuntas</p>
       ${(p.fotos ?? []).map((u, i) =>
         `<a href="${u}" style="color:#3D8BF0;font-size:14px;display:block;margin-bottom:4px;">Foto ${i + 1}</a>`
       ).join("")}`
    : "";

  return `
  <div style="background:#0A0B0D;padding:32px 16px;font-family:Helvetica,Arial,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#101317;border:1px solid #232830;">
      <div style="height:3px;background:#1668D6;"></div>
      <div style="padding:28px 32px;">
        <p style="color:#8C939E;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;margin:0 0 6px 0;">Consulta nueva</p>
        <h1 style="color:#3D8BF0;font-size:22px;letter-spacing:0.05em;margin:0 0 22px 0;">${escapeHtml(p.numero ?? "")}</h1>

        <table style="width:100%;border-collapse:collapse;">
          ${fila("Producto", p.producto)}
          ${fila("Detalle", p.detalle)}
          ${fila("Referencia", p.referencia)}
          ${fila("Código", p.sku)}
        </table>

        <div style="margin-top:22px;padding-top:18px;border-top:1px solid #232830;">
          <table style="width:100%;border-collapse:collapse;">
            ${fila("Cliente", p.nombre)}
            ${fila("Email", p.email)}
            ${fila("WhatsApp", p.whatsapp)}
          </table>
        </div>

        ${fotos}
      </div>
      <div style="padding:14px 32px;border-top:1px solid #232830;">
        <p style="color:#5B626C;font-size:12px;margin:0;">Respondela desde el panel: /admin/consultas</p>
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

  if (!process.env.RESEND_API_KEY || !OWNER_EMAIL) {
    console.warn(
      `[consulta-nueva] ${payload.numero ?? "sin número"} recibida. ` +
      "Falta RESEND_API_KEY o RESEND_OWNER_EMAIL: no se envía el aviso, " +
      "pero la consulta está guardada y aparece en /admin/consultas."
    );
    return NextResponse.json({ ok: true, avisado: false });
  }

  try {
    await getResend().emails.send({
      from:    FROM_EMAIL,
      to:      OWNER_EMAIL,
      replyTo: payload.email,
      subject: `Pedido por encargo ${payload.numero ?? ""} — ${payload.producto ?? "sin detallar"}`,
      html:    emailHtml(payload),
    });
    return NextResponse.json({ ok: true, avisado: true });
  } catch (err) {
    console.error("[consulta-nueva] no se pudo enviar el aviso:", err);
    return NextResponse.json({ ok: true, avisado: false });
  }
}

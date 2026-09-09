import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

// ── Cliente Resend (server-only, la API key nunca llega al browser) ─────────
// Se crea recién cuando hace falta: sin RESEND_API_KEY el constructor tira,
// y eso rompía el build entero antes de que hubiera credenciales cargadas.
let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

const FROM_EMAIL   = process.env.RESEND_FROM_EMAIL   || "ARG Indumentaria <onboarding@resend.dev>";
const OWNER_EMAIL   = process.env.RESEND_OWNER_EMAIL;

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  transferencia: "Transferencia bancaria",
  efectivo:      "Efectivo",
  mercadopago:   "MercadoPago",
};

interface OrderItemPayload {
  title:    string;
  quantity: number;
  price:    number;
}

interface OrderConfirmationPayload {
  orderNumber:       string;
  customerName:      string;
  customerEmail:     string;
  items:             OrderItemPayload[];
  subtotal:          number;
  shippingCost?:     number;   // piezas a pedido: el flete va discriminado
  total:             number;
  paymentMethod:     string;
  shippingAddress:   string;
  shippingCity:      string;
  shippingProvince?: string | null;
}

function money(n: number) {
  return `$${n.toLocaleString("es-AR")}`;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function itemsRowsHtml(items: OrderItemPayload[]) {
  return items
    .map(
      (i) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #222;color:#ddd;font-size:14px;">${escapeHtml(i.title)}</td>
          <td style="padding:10px 0;border-bottom:1px solid #222;color:#999;font-size:14px;text-align:center;">×${i.quantity}</td>
          <td style="padding:10px 0;border-bottom:1px solid #222;color:#3D8BF0;font-size:14px;text-align:right;">${money(i.price * i.quantity)}</td>
        </tr>`
    )
    .join("");
}

function wrapperHtml(title: string, bodyHtml: string) {
  return `
  <div style="background:#0d0f12;padding:32px 16px;font-family:monospace,Consolas,monospace;">
    <div style="max-width:520px;margin:0 auto;background:#12161a;border:1px solid #1f2937;border-radius:16px;overflow:hidden;">
      <div style="padding:28px 32px 0 32px;">
        <p style="color:#4b5563;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;margin:0 0 4px 0;">ARG Indumentaria</p>
        <h1 style="color:#3D8BF0;font-size:20px;letter-spacing:0.05em;text-transform:uppercase;margin:0 0 24px 0;">${title}</h1>
      </div>
      <div style="padding:0 32px 32px 32px;">
        ${bodyHtml}
      </div>
      <div style="padding:16px 32px;border-top:1px solid #1f2937;">
        <p style="color:#4b5563;font-size:11px;letter-spacing:0.1em;margin:0;">ARG INDUMENTARIA — Indumentaria y calzado para toda la familia</p>
      </div>
    </div>
  </div>`;
}

function customerEmailHtml(p: OrderConfirmationPayload) {
  const body = `
    <p style="color:#ccc;font-size:15px;line-height:1.5;">Hola ${escapeHtml(p.customerName)}, ¡gracias por tu compra! Recibimos tu pedido y ya lo estamos preparando.</p>
    <p style="color:#3D8BF0;font-size:18px;font-weight:bold;margin:20px 0 4px 0;">${escapeHtml(p.orderNumber)}</p>
    <table style="width:100%;border-collapse:collapse;margin-top:16px;">
      ${itemsRowsHtml(p.items)}
    </table>
    <table style="width:100%;margin-top:16px;">
      <tr><td style="color:#999;font-size:13px;padding:2px 0;">Subtotal</td><td style="color:#ccc;font-size:13px;text-align:right;">${money(p.subtotal)}</td></tr>
      ${(p.shippingCost ?? 0) > 0
        ? `<tr><td style="color:#999;font-size:13px;padding:2px 0;">Envío</td><td style="color:#ccc;font-size:13px;text-align:right;">${money(p.shippingCost!)}</td></tr>`
        : ""}
      <tr><td style="color:#eee;font-size:16px;font-weight:bold;padding:8px 0 0 0;">Total</td><td style="color:#3D8BF0;font-size:16px;font-weight:bold;text-align:right;padding:8px 0 0 0;">${money(p.total)}</td></tr>
    </table>
    <div style="margin-top:24px;padding:16px;background:#0d0f12;border:1px solid #1f2937;border-radius:8px;">
      <p style="color:#666;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;margin:0 0 6px 0;">Envío</p>
      <p style="color:#ccc;font-size:13px;margin:0;">${escapeHtml(p.shippingAddress)}, ${escapeHtml(p.shippingCity)}${p.shippingProvince ? `, ${escapeHtml(p.shippingProvince)}` : ""}</p>
    </div>
    <div style="margin-top:12px;padding:16px;background:#0d0f12;border:1px solid #1f2937;border-radius:8px;">
      <p style="color:#666;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;margin:0 0 6px 0;">Método de pago</p>
      <p style="color:#ccc;font-size:13px;margin:0;">${PAYMENT_METHOD_LABEL[p.paymentMethod] ?? p.paymentMethod}</p>
    </div>
    <p style="color:#666;font-size:12px;margin-top:24px;">Cualquier consulta sobre tu pedido, respondé este email o escribinos por WhatsApp o Instagram.</p>
  `;
  return wrapperHtml("¡Pedido recibido!", body);
}

function ownerEmailHtml(p: OrderConfirmationPayload) {
  const body = `
    <p style="color:#ccc;font-size:15px;">Nuevo pedido de <strong style="color:#fff;">${escapeHtml(p.customerName)}</strong> (${escapeHtml(p.customerEmail)}).</p>
    <p style="color:#3D8BF0;font-size:18px;font-weight:bold;margin:20px 0 4px 0;">${escapeHtml(p.orderNumber)}</p>
    <table style="width:100%;border-collapse:collapse;margin-top:16px;">
      ${itemsRowsHtml(p.items)}
    </table>
    <table style="width:100%;margin-top:16px;">
      ${(p.shippingCost ?? 0) > 0
        ? `<tr><td style="color:#999;font-size:13px;padding:2px 0;">Pieza</td><td style="color:#ccc;font-size:13px;text-align:right;">${money(p.subtotal)}</td></tr>
           <tr><td style="color:#999;font-size:13px;padding:2px 0;">Envío</td><td style="color:#ccc;font-size:13px;text-align:right;">${money(p.shippingCost!)}</td></tr>`
        : ""}
      <tr><td style="color:#eee;font-size:16px;font-weight:bold;padding:8px 0 0 0;">Total</td><td style="color:#3D8BF0;font-size:16px;font-weight:bold;text-align:right;padding:8px 0 0 0;">${money(p.total)}</td></tr>
    </table>
    <div style="margin-top:24px;padding:16px;background:#0d0f12;border:1px solid #1f2937;border-radius:8px;">
      <p style="color:#666;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;margin:0 0 6px 0;">Envío</p>
      <p style="color:#ccc;font-size:13px;margin:0;">${escapeHtml(p.shippingAddress)}, ${escapeHtml(p.shippingCity)}${p.shippingProvince ? `, ${escapeHtml(p.shippingProvince)}` : ""}</p>
    </div>
    <div style="margin-top:12px;padding:16px;background:#0d0f12;border:1px solid #1f2937;border-radius:8px;">
      <p style="color:#666;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;margin:0 0 6px 0;">Método de pago</p>
      <p style="color:#ccc;font-size:13px;margin:0;">${PAYMENT_METHOD_LABEL[p.paymentMethod] ?? p.paymentMethod}</p>
    </div>
    <p style="color:#666;font-size:12px;margin-top:24px;">Vé al panel admin → Pedidos para gestionarlo.</p>
  `;
  return wrapperHtml("Nuevo pedido 🛒", body);
}

export async function POST(request: NextRequest) {
  if (!process.env.RESEND_API_KEY) {
    // No configurado — no rompemos el checkout, solo avisamos en logs del server.
    console.error("[order-confirmation] RESEND_API_KEY no configurada, se omite el envío de emails.");
    return NextResponse.json({ ok: false, reason: "not_configured" }, { status: 200 });
  }

  let payload: OrderConfirmationPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_body" }, { status: 400 });
  }

  if (!payload?.orderNumber || !Array.isArray(payload.items)) {
    return NextResponse.json({ ok: false, reason: "invalid_payload" }, { status: 400 });
  }

  const results = await Promise.allSettled([
    // Email al cliente (solo llega de verdad una vez que el dominio esté verificado en Resend)
    payload.customerEmail
      ? getResend().emails.send({
          from:    FROM_EMAIL,
          to:      payload.customerEmail,
          subject: `Pedido confirmado ${payload.orderNumber} — ARG Indumentaria`,
          html:    customerEmailHtml(payload),
        })
      : Promise.resolve(null),
    // Email a los dueños
    OWNER_EMAIL
      ? getResend().emails.send({
          from:    FROM_EMAIL,
          to:      OWNER_EMAIL,
          subject: `🛒 Nuevo pedido ${payload.orderNumber}`,
          html:    ownerEmailHtml(payload),
        })
      : Promise.resolve(null),
  ]);

  results.forEach((r, i) => {
    if (r.status === "rejected") {
      console.error(`[order-confirmation] fallo al enviar email #${i}:`, r.reason);
    }
  });

  // Siempre 200: un fallo de email nunca debe romper la experiencia de compra.
  return NextResponse.json({ ok: true });
}

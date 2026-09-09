// src/app/api/checkout/mercadopago/route.ts
//
// Arma la sesión de pago de Mercado Pago para un pedido que YA existe
// (creado antes con el RPC place_order, igual que transferencia/efectivo).
// El checkout llama acá después de crear el pedido, y si esto responde
// bien, redirige al cliente a la URL que devuelve.
//
// Regla del brief (sección 5): "no calcular precios finales en el front".
// Por eso el monto SIEMPRE sale de get_order_for_payment() (la base),
// nunca de lo que mande este mismo request — ni de un total que el
// checkout ya calculó del lado del cliente.

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getPaymentProvider } from "@/lib/payments";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  const orderId =
    typeof (body as { orderId?: unknown })?.orderId === "string"
      ? (body as { orderId: string }).orderId
      : "";
  const email =
    typeof (body as { email?: unknown })?.email === "string"
      ? (body as { email: string }).email.trim().toLowerCase()
      : "";

  if (!orderId || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Faltan datos del pedido." }, { status: 400 });
  }

  // get_order_for_payment es SECURITY DEFINER: un pedido de invitado (sin
  // login) no pasa la policy normal de SELECT en orders, así que esto no
  // se puede reemplazar por un simple .from("orders").select(...).
  const { data: order, error: orderErr } = await supabase
    .rpc("get_order_for_payment", { p_order_id: orderId })
    .single();

  if (orderErr || !order) {
    return NextResponse.json({ error: "No encontramos ese pedido." }, { status: 404 });
  }

  const { order_number: orderNumber, total, payment_status: paymentStatus } = order as {
    order_number: string;
    total: number;
    payment_status: string;
  };

  if (paymentStatus === "paid") {
    return NextResponse.json({ error: "Este pedido ya está pagado." }, { status: 409 });
  }

  const appUrl = (process.env.APP_URL || request.nextUrl.origin).replace(/\/$/, "");
  const encodedOrder = encodeURIComponent(orderNumber);

  try {
    const provider = getPaymentProvider("mercadopago");

    const session = await provider.createCheckoutSession({
      orderId,
      orderNumber,
      amount: Number(total),
      // Mercado Pago para una cuenta argentina cobra en ARS — ver
      // claude/pagos-2026-09-05.md sobre el estado de USD con MP.
      currency: "ars",
      customerEmail: email,
      description: `Pedido ${orderNumber} — ARG Indumentaria`,
      successUrl: `${appUrl}/checkout/mercadopago/exito?pedido=${encodedOrder}`,
      pendingUrl: `${appUrl}/checkout/mercadopago/pendiente?pedido=${encodedOrder}`,
      cancelUrl: `${appUrl}/checkout/mercadopago/error?pedido=${encodedOrder}`,
      metadata: { order_id: orderId, order_number: orderNumber },
    });

    return NextResponse.json({ redirectUrl: session.redirectUrl });
  } catch (err) {
    console.error("[checkout/mercadopago] error al crear la sesión:", err);
    return NextResponse.json(
      { error: "No pudimos iniciar el pago con Mercado Pago. Intentá de nuevo." },
      { status: 500 }
    );
  }
}

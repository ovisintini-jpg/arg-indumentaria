// src/lib/payments/providers/stripe-provider.ts
//
// Provider principal (ver claude/pagos-2026-09-05.md). Cobra siempre en USD.
// Credenciales de TEST primero — nunca las de producción hasta el paso 9
// del brief ("Pasar a credenciales productivas").

import Stripe from "stripe";
import type {
  CheckoutOrder,
  CheckoutSessionResult,
  PaymentProvider,
  PaymentStatus,
  PaymentStatusResult,
  WebhookEvent,
  WebhookRequest,
} from "../types";

function client(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "Falta STRIPE_SECRET_KEY en las variables de entorno (ver .env.example)."
    );
  }
  return new Stripe(key);
}

export class StripeProvider implements PaymentProvider {
  readonly name = "stripe" as const;

  async createCheckoutSession(order: CheckoutOrder): Promise<CheckoutSessionResult> {
    if (order.currency !== "usd") {
      throw new Error("StripeProvider sólo cobra en USD por ahora.");
    }

    const stripe = client();

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: order.customerEmail,
      line_items: [
        {
          price_data: {
            currency: "usd",
            // Stripe pide la unidad mínima de la moneda (centavos en USD).
            unit_amount: Math.round(order.amount * 100),
            product_data: {
              name: order.description || `Pedido ${order.orderNumber}`,
            },
          },
          quantity: 1,
        },
      ],
      success_url: order.successUrl,
      cancel_url: order.cancelUrl,
      metadata: {
        order_id: order.orderId,
        order_number: order.orderNumber,
        ...order.metadata,
      },
    });

    if (!session.url) {
      throw new Error("Stripe no devolvió una URL de checkout.");
    }

    return { redirectUrl: session.url, providerRef: session.id };
  }

  verifyWebhook(request: WebhookRequest): WebhookEvent {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      throw new Error(
        "Falta STRIPE_WEBHOOK_SECRET en las variables de entorno (ver .env.example)."
      );
    }
    const signatureHeader = request.headers["stripe-signature"];
    if (!signatureHeader) {
      throw new Error("Falta la cabecera stripe-signature — no se procesa el evento.");
    }

    const stripe = client();
    const rawBody = request.rawBody;
    // stripe.webhooks.constructEvent tira si la firma no es válida.
    // Ese throw es intencional: el endpoint que llame esto NO debe procesar
    // nada si esta línea falla (regla del brief, sección 3.5).
    const event = stripe.webhooks.constructEvent(rawBody, signatureHeader, secret);

    const session = event.data.object as Stripe.Checkout.Session;

    let status: PaymentStatus | null = null;
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      status = "approved";
    } else if (
      event.type === "checkout.session.async_payment_failed" ||
      event.type === "checkout.session.expired"
    ) {
      status = "rejected";
    }

    return {
      provider: "stripe",
      eventId: event.id,
      type: event.type,
      providerRef: session?.id ?? null,
      status,
      raw: event,
    };
  }

  async getPaymentStatus(providerRef: string): Promise<PaymentStatusResult> {
    const stripe = client();
    const session = await stripe.checkout.sessions.retrieve(providerRef);

    const status =
      session.payment_status === "paid" ? "approved" :
      session.status === "expired" ? "rejected" :
      "pending";

    return {
      status,
      externalReference: (session.metadata?.order_id as string | undefined) ?? null,
    };
  }
}

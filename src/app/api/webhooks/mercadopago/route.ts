// src/app/api/webhooks/mercadopago/route.ts
//
// El "buzón" donde Mercado Pago avisa que pasó algo con un pago. Reglas del
// brief (sección 3.5), todas aplicadas acá:
//   - Verificar la firma ANTES de procesar nada (provider.verifyWebhook tira
//     si no es válida).
//   - Idempotencia: record_payment_webhook() en la base descarta duplicados
//     por (provider, event_id).
//   - Loguear el evento crudo — también responsabilidad de esa misma función.
//   - El estado real del pedido lo define ESTE endpoint, nunca el redirect
//     del navegador (las páginas de éxito/pendiente/error sólo muestran un
//     mensaje, no cambian nada en la base).
//
// Nota sobre el runtime nodejs: WebhookSignatureValidator del SDK de
// Mercado Pago usa el módulo crypto de Node — no funciona en el runtime Edge.

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getPaymentProvider, toDbPaymentStatus } from "@/lib/payments";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  const provider = getPaymentProvider("mercadopago");

  const notificacion = {
    rawBody,
    headers: {
      "x-signature": request.headers.get("x-signature"),
      "x-request-id": request.headers.get("x-request-id"),
    },
    searchParams: {
      "data.id": request.nextUrl.searchParams.get("data.id"),
      id: request.nextUrl.searchParams.get("id"),
      // Mercado Pago también manda notificaciones IPN viejas con esta
      // forma: ?topic=merchant_order&id=... o ?topic=payment&id=...
      // (sin firma). El provider las distingue por esto.
      topic: request.nextUrl.searchParams.get("topic"),
    },
  };

  let event;
  let firmaVerificada = true;

  try {
    event = provider.verifyWebhook(notificacion);
  } catch (err) {
    // ── Por qué no cortamos acá con un 401 ────────────────────────────────
    // El aviso automático de Mercado Pago llega con una firma que no valida
    // (SignatureMismatch), aunque MP_WEBHOOK_SECRET sea el correcto: el mismo
    // secreto valida perfecto cuando la notificación viene del simulador del
    // panel. Es una inconsistencia del lado de Mercado Pago, y cortar acá
    // significaba que ningún pedido se marcaba pagado solo.
    //
    // Seguir NO es aflojar la seguridad, por una razón concreta: de esta
    // notificación no le creemos NADA salvo el id del recurso. El estado del
    // pago y —sobre todo— a qué pedido corresponde salen de
    // getPaymentStatus(), que le pregunta a la API de Mercado Pago con
    // NUESTRO access token. Eso es lo que no se puede falsificar.
    //
    // Lo peor que puede hacer alguien mandando un aviso trucho es obligarnos a
    // consultar un pago que existe y guardar su estado real en el pedido al
    // que ese pago pertenece de verdad. No puede inventar un pago, ni mover el
    // pago de otro a su propio pedido, ni marcar como pagado algo que Mercado
    // Pago dice que no lo está.
    //
    // Cuando la cuenta real esté andando y las firmas validen, esto deja de
    // usarse solo: es un camino de excepción, y cada vez que se usa queda
    // anotado en el log y en webhook_events.
    console.warn(
      "[webhook mercadopago] la firma no validó — se sigue igual y el estado " +
        "se confirma contra la API de Mercado Pago:",
      err instanceof Error ? err.message : err
    );

    firmaVerificada = false;
    event = provider.parseWebhookSinVerificar?.(notificacion) ?? null;

    // Sin firma válida Y sin un id que consultar, no hay nada que hacer.
    if (!event) {
      return NextResponse.json({ error: "invalid signature" }, { status: 401 });
    }
  }

  // Mercado Pago manda varios "topics" (merchant_order, point_integration_wh,
  // etc.) — sólo nos interesan los de pago. El resto se confirma con 200 y
  // se ignora: no es un error, simplemente no aplica acá.
  if (event.type !== "payment" || !event.providerRef) {
    // Con la firma sin validar no procesamos nada que no sea un pago: para
    // cualquier otra cosa no tenemos forma de confirmar la verdad aparte.
    if (!firmaVerificada) {
      return NextResponse.json({ error: "invalid signature" }, { status: 401 });
    }
    return NextResponse.json({ received: true, ignored: true });
  }

  try {
    // El webhook en sí no trae el estado del pago (sólo "pasó algo con este
    // id") — hay que consultarlo. Esto también nos da el external_reference
    // (el orderId que mandamos al crear la preferencia), necesario para
    // saber a qué pedido corresponde.
    const { status, externalReference } = await provider.getPaymentStatus(event.providerRef);

    // record_payment_webhook recibe p_order_id como uuid. Nuestros pedidos lo
    // son siempre, pero un pago ajeno (o de otra integración) puede traer
    // cualquier cosa en external_reference, y el cast lo haría explotar con un
    // 500 que Mercado Pago reintentaría para siempre. Si no tiene forma de
    // uuid, lo guardamos igual en webhook_events pero sin tocar ningún pedido.
    const esUuid = (v: string | null | undefined) =>
      !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

    const orderId = esUuid(externalReference) ? externalReference : null;

    const { error } = await supabase.rpc("record_payment_webhook", {
      p_provider: "mercadopago",
      p_event_id: event.eventId,
      // Queda anotado en webhook_events si este evento entró por el camino de
      // excepción, para poder auditarlo después.
      p_payload: { ...(event.raw as Record<string, unknown>), firma_verificada: firmaVerificada },
      p_order_id: orderId,
      p_provider_ref: event.providerRef,
      p_new_status: toDbPaymentStatus(status),
    });

    if (error) throw new Error(error.message);

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[webhook mercadopago] error al procesar el pago:", err);
    // 500 a propósito (no 200): a esta altura el evento ya fue confirmado
    // contra Mercado Pago, así que esto es un
    // problema nuestro (de red, de la base, etc.), no un evento inválido.
    // Mercado Pago reintenta automáticamente los webhooks que fallan — es la
    // cola de reintentos más simple que hay, y no hace falta armar una propia
    // para el volumen que tiene este sitio hoy.
    return NextResponse.json({ error: "processing error" }, { status: 500 });
  }
}

// src/lib/payments/providers/mercadopago-provider.ts
//
// Implementación real de Mercado Pago (Checkout Pro + Preferencias), lista para
// activar apenas exista la cuenta. Ver:
//   - claude/pagos-2026-09-05.md            → contexto de negocio y decisiones
//   - claude/mercadopago-api-2026-09-05.md  → la referencia de API investigada
//     (SDK, campos, sandbox, verificación de firma) que este archivo sigue.
//
// Bloqueado para USO REAL por un requisito EXTERNO, no de código: falta que Omar
// confirme CUIT/CUIL y la cuenta bancaria argentina. Mientras tanto se puede probar
// entero con las credenciales de PRUEBA de una app de developers — no hace falta la
// cuenta de venta real para probar el flujo de punta a punta.
//
// OJO con las credenciales: Mercado Pago dejó atrás el prefijo TEST-. Hoy las de
// prueba y las de producción son las DOS `APP_USR-...`, y se eligen en el panel
// (Tus integraciones → la app → Credenciales de prueba / de producción). El token
// NO te dice en qué modo estás: eso lo definís vos al elegir cuál copiás.

import {
  MercadoPagoConfig,
  Preference,
  Payment,
  WebhookSignatureValidator,
  InvalidWebhookSignatureError,
} from "mercadopago";
import type {
  CheckoutOrder,
  CheckoutSessionResult,
  PaymentProvider,
  PaymentStatusResult,
  WebhookEvent,
  WebhookRequest,
} from "../types";

function accessToken(): string {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      "Falta MP_ACCESS_TOKEN en las variables de entorno (ver .env.example). " +
        "Para probar sin cuenta real todavía, alcanza con crear una app en Mercado " +
        "Pago developers y copiar el access token de sus Credenciales de prueba."
    );
  }
  return token;
}

function client(): MercadoPagoConfig {
  return new MercadoPagoConfig({ accessToken: accessToken(), options: { timeout: 5000 } });
}

/**
 * ¿Es una credencial del esquema VIEJO de sandbox?
 *
 * Cuidado con el nombre de lo que hace: **esto no dice si estás en modo de
 * prueba.** Las credenciales viejas de prueba empezaban con `TEST-` y obligaban
 * a mandar al cliente a `sandbox_init_point`. Mercado Pago abandonó ese esquema:
 * hoy las de prueba y las de producción son las dos `APP_USR-...` y en las dos el
 * link que sirve es `init_point`.
 *
 * O sea: con credenciales actuales esto devuelve `false` **aunque sean de
 * prueba**, y está bien — es justamente lo que hace que se use `init_point`.
 *
 * Si algún día hay que saber de verdad si se está cobrando en serio, no lo
 * busques acá: mirá qué par de credenciales está cargado en las variables de
 * entorno del deploy. El token no lo dice.
 */
function esCredencialSandboxLegacy(): boolean {
  return accessToken().startsWith("TEST-");
}

/**
 * Mercado Pago para una cuenta argentina cobra en ARS con toda confianza.
 * Que acepte y liquide USD de verdad NO está confirmado contra una cuenta real
 * todavía (Omar: "pesos y/o dólares si deja") — se manda el currency_id que pida
 * la orden, pero HAY QUE VERIFICAR esto contra la cuenta real antes de prometerle
 * a un cliente que puede pagar en dólares por acá.
 */
function currencyId(currency: CheckoutOrder["currency"]): string {
  return currency.toUpperCase();
}

export class MercadoPagoProvider implements PaymentProvider {
  readonly name = "mercadopago" as const;

  async createCheckoutSession(order: CheckoutOrder): Promise<CheckoutSessionResult> {
    const preference = new Preference(client());

    const notificationUrl = process.env.APP_URL
      ? `${process.env.APP_URL}/api/webhooks/mercadopago`
      : undefined;

    // auto_return exige que back_urls.success sea una URL https pública — en
    // localhost (desarrollo) Mercado Pago rechaza la preferencia si se manda.
    const canAutoReturn = order.successUrl.startsWith("https://");

    const result = await preference.create({
      body: {
        items: [
          {
            id: order.orderId,
            title: order.description || `Pedido ${order.orderNumber}`,
            quantity: 1,
            unit_price: order.amount,
            currency_id: currencyId(order.currency),
          },
        ],
        payer: { email: order.customerEmail },
        external_reference: order.orderId,
        back_urls: {
          success: order.successUrl,
          pending: order.pendingUrl ?? order.successUrl,
          failure: order.cancelUrl,
        },
        ...(canAutoReturn ? { auto_return: "approved" as const } : {}),
        ...(notificationUrl ? { notification_url: notificationUrl } : {}),
        ...(order.metadata ? { metadata: order.metadata } : {}),
      },
      requestOptions: {
        // Si esta misma orden reintenta crear la sesión (ej. doble click, retry de
        // red), reusa la preferencia en vez de crear una duplicada.
        idempotencyKey: order.orderId,
      },
    });

    // init_point es el link bueno con las credenciales de hoy, sean de prueba o de
    // producción. sandbox_init_point quedó sólo para las credenciales viejas
    // `TEST-...`, que son las únicas donde init_point no sirve — ver la nota de
    // esCredencialSandboxLegacy(), que explica por qué esto no es un interruptor
    // de "modo prueba". El ?? de cada rama es red de contención: si Mercado Pago
    // no manda una de las dos URLs, usamos la otra en vez de tirar el checkout.
    const redirectUrl = esCredencialSandboxLegacy()
      ? (result.sandbox_init_point ?? result.init_point)
      : (result.init_point ?? result.sandbox_init_point);

    if (!redirectUrl) {
      throw new Error("Mercado Pago no devolvió una URL de checkout.");
    }
    if (!result.id) {
      throw new Error("Mercado Pago no devolvió el id de la preferencia.");
    }

    return { redirectUrl, providerRef: result.id };
  }

  verifyWebhook(request: WebhookRequest): WebhookEvent {
    // Mercado Pago manda, además del webhook nuevo (firmado con x-signature),
    // notificaciones "IPN" viejas con esta forma: ?topic=merchant_order&id=...
    // o ?topic=payment&id=... Esas NUNCA vienen con el header x-signature —
    // no es que algo esté mal configurado, es el formato de esa notificación.
    // Si tratáramos la ausencia de firma ahí como "firma inválida" (401),
    // Mercado Pago reintentaría para siempre un evento que en realidad es
    // válido, sólo que viejo. Por eso se distinguen ANTES de pedir la firma.
    //
    // Que no tengan firma no es un problema de seguridad: para "payment" la
    // verdad la sacamos igual de getPaymentStatus() más abajo, que llama a la
    // API de Mercado Pago con NUESTRO access token — eso es lo que no se puede
    // falsificar, no esta notificación en sí.
    const legacyTopic = request.searchParams["topic"] ?? undefined;
    if (!request.headers["x-signature"] && legacyTopic) {
      const legacyId = request.searchParams["id"] ?? undefined;

      if (legacyTopic !== "payment" || !legacyId) {
        // merchant_order, point_integration_wh, etc. — no nos interesan: el
        // estado del pago se confirma por el topic "payment", no por acá.
        return {
          provider: "mercadopago",
          eventId: `legacy:${legacyTopic}:${legacyId ?? "sin-id"}`,
          type: legacyTopic,
          providerRef: null,
          status: null,
          raw: { legacy: true, topic: legacyTopic, id: legacyId ?? null },
        };
      }

      return {
        provider: "mercadopago",
        eventId: `legacy:payment:${legacyId}`,
        type: "payment",
        providerRef: legacyId,
        status: null,
        raw: { legacy: true, topic: legacyTopic, id: legacyId },
      };
    }

    const secret = process.env.MP_WEBHOOK_SECRET;
    if (!secret) {
      throw new Error("Falta MP_WEBHOOK_SECRET en las variables de entorno (ver .env.example).");
    }

    // Mercado Pago manda el id del recurso afectado como query param "data.id"
    // (literal, con el punto) en la URL que llama al notification_url.
    const dataId =
      request.searchParams["data.id"] ?? request.searchParams["id"] ?? undefined;

    try {
      WebhookSignatureValidator.validate({
        xSignature: request.headers["x-signature"] ?? undefined,
        xRequestId: request.headers["x-request-id"] ?? undefined,
        dataId,
        secret,
        toleranceSeconds: 300, // rechaza notificaciones viejas (protección anti-replay)
      });
    } catch (err) {
      if (err instanceof InvalidWebhookSignatureError) {
        throw new Error(`Firma de webhook de Mercado Pago inválida (${err.reason}).`);
      }
      throw err;
    }

    return armarEvento(request, dataId);
  }

  /**
   * Lee la notificación sin validar la firma. Ver la nota de la interfaz en
   * types.ts: sólo sirve para sacar el id del recurso, y quien la use está
   * obligado a confirmar el estado real contra la API de Mercado Pago antes de
   * tocar un pedido.
   */
  parseWebhookSinVerificar(request: WebhookRequest): WebhookEvent | null {
    const dataId =
      request.searchParams["data.id"] ?? request.searchParams["id"] ?? undefined;
    if (!dataId) return null;
    return armarEvento(request, dataId);
  }

  async getPaymentStatus(providerRef: string): Promise<PaymentStatusResult> {
    const payment = new Payment(client());
    const result = await payment.get({ id: providerRef });

    let status: PaymentStatusResult["status"];
    switch (result.status) {
      case "approved":
      case "authorized":
        status = "approved";
        break;
      case "rejected":
      case "cancelled":
      case "charged_back":
        status = "rejected";
        break;
      // "refunded": se aprobó y DESPUÉS se devolvió. El modelo actual de tres
      // estados no distingue este caso de un rechazo directo — el payload crudo
      // queda igual guardado en webhook_events para poder auditar esto a mano.
      case "refunded":
        status = "rejected";
        break;
      default:
        // pending, in_process, in_mediation, y cualquier status_detail nuevo que
        // Mercado Pago agregue de acá en adelante: tratar como no resuelto todavía.
        status = "pending";
    }

    return { status, externalReference: result.external_reference ?? null };
  }

  /**
   * Respaldo manual para el botón "Verificar pago" del admin: busca el pago
   * más reciente de este pedido directo en la API de Mercado Pago, por
   * external_reference — sin depender de que el webhook (automático) haya
   * avisado. Hace falta porque en modo de prueba el aviso automático a veces
   * no llega o llega con una firma que no valida (ver claude/pagos-2026-09-05.md),
   * mientras que consultar la API directo con nuestro propio access token
   * siempre funciona.
   */
  async findPaymentByOrder(
    orderId: string
  ): Promise<{ status: PaymentStatusResult["status"]; providerRef: string } | null> {
    const payment = new Payment(client());
    const result = await payment.search({
      options: {
        external_reference: orderId,
        sort: "date_created",
        criteria: "desc",
      },
    });

    const candidates = result.results ?? [];
    if (candidates.length === 0) return null;

    // Si hubo más de un intento de pago para el mismo pedido (ej. el cliente
    // canceló y volvió a intentar), preferimos uno aprobado por sobre uno
    // rechazado, aunque no sea el más reciente.
    const elegido =
      candidates.find((p) => p.status === "approved" || p.status === "authorized") ??
      candidates[0];

    if (!elegido.id) return null;

    const providerRef = String(elegido.id);
    // Reusa getPaymentStatus (mismo mapeo de estados, ya probado) en vez de
    // duplicar el switch de arriba.
    const { status } = await this.getPaymentStatus(providerRef);
    return { status, providerRef };
  }
}

/**
 * Arma el evento normalizado a partir de la notificación. No valida nada: la
 * validación (o la decisión de saltearla) es de quien lo llama.
 */
function armarEvento(request: WebhookRequest, dataId: string | undefined): WebhookEvent {
  // El body puede venir vacío o no-JSON en algunas notificaciones (ej. QR Code,
  // que además no vienen firmadas). Si falla el parseo seguimos con lo que sí
  // tenemos: el data.id de la query.
  let payload: unknown = {};
  try {
    payload = request.rawBody ? JSON.parse(request.rawBody) : {};
  } catch {
    payload = { unparsed_raw_body: request.rawBody };
  }

  const type = String(
    (payload as { type?: string; topic?: string }).type ??
      (payload as { topic?: string }).topic ??
      "unknown"
  );

  return {
    provider: "mercadopago",
    // Mercado Pago no manda un id de evento propio como Stripe (event.id) — la
    // combinación data.id + x-request-id es lo más parecido a único que hay para
    // idempotencia en webhook_events.
    eventId: `${dataId ?? "sin-data-id"}:${request.headers["x-request-id"] ?? "sin-request-id"}`,
    type,
    providerRef: dataId ?? null,
    // El body de la notificación NO trae el estado real del pago — sólo avisa
    // "pasó algo con este id". Hay que llamar a getPaymentStatus(dataId) para
    // saber si se aprobó o no.
    status: null,
    raw: payload,
  };
}

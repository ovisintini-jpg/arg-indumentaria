// src/lib/payments/types.ts
//
// Interfaz común de pagos. Ver claude/pagos-2026-09-05.md en el proyecto de
// Claude para el porqué de cada decisión. Resumen:
//
//   - Stripe cobra siempre en USD (se liquida a la cuenta bancaria de EE.UU.
//     de la LLC/Corp).
//   - Mercado Pago cobra en el currency_id que le pidamos (ARS es lo seguro
//     para una cuenta argentina; USD todavía no está confirmado contra la
//     cuenta real — Omar dejó la puerta abierta a "pesos y/o dólares si
//     deja", hay que verificarlo cuando exista la cuenta).
//   - El checkout arma un CheckoutOrder con datos YA VERIFICADOS en el
//     backend. Ningún provider debe confiar en un monto que venga del browser.

export type Currency = "usd" | "ars";

export type PaymentProviderName = "stripe" | "mercadopago";

export type PaymentStatus = "pending" | "approved" | "rejected";

/**
 * Lo mínimo que un provider necesita para armar una sesión de cobro.
 * `amount` va en unidades de la moneda (ej. 129.90), NO en centavos —
 * cada provider convierte a la unidad mínima que le pida su propia API.
 */
export interface CheckoutOrder {
  orderId: string;
  orderNumber: string;
  amount: number;
  currency: Currency;
  customerEmail: string;
  description?: string;
  successUrl: string;
  cancelUrl: string;
  /**
   * A dónde mandar al cliente si el pago queda "pendiente" en vez de
   * aprobado o rechazado (común en Mercado Pago: Rapipago, Pago Fácil,
   * transferencia dentro de la app). Si no se manda, el provider usa
   * `successUrl`. Stripe Checkout no tiene un tercer estado de redirect,
   * así que StripeProvider ignora este campo.
   */
  pendingUrl?: string;
  metadata?: Record<string, string>;
}

export interface CheckoutSessionResult {
  redirectUrl: string;
  /** Id de la sesión/pago en el provider — se guarda en orders.provider_ref */
  providerRef: string;
}

/**
 * Resultado de consultar un pago puntual. `externalReference` es el
 * `CheckoutOrder.orderId` que se mandó al crear la sesión — Stripe lo trae
 * directo en el evento del webhook (metadata), así que no siempre hace
 * falta esta consulta para conseguirlo; Mercado Pago NO lo manda en la
 * notificación del webhook, sólo acá, consultando el pago por su id.
 */
export interface PaymentStatusResult {
  status: PaymentStatus;
  externalReference: string | null;
}

/**
 * Lo que el endpoint público del webhook (route handler) le pasa al provider.
 * Distintos providers necesitan distintas partes de esto para validar la
 * firma — Stripe sólo usa rawBody + headers['stripe-signature']; Mercado
 * Pago necesita además x-request-id y el query param "data.id" de la URL
 * que Mercado Pago llamó. Por eso el objeto lleva las tres cosas siempre,
 * aunque un provider puntual no use alguna.
 *
 * Las claves de `headers` deben venir en minúscula (así es como Next.js las
 * expone igual, pero documentado por si se arma a mano).
 */
export interface WebhookRequest {
  rawBody: string;
  headers: Record<string, string | null | undefined>;
  searchParams: Record<string, string | null | undefined>;
}

/**
 * Evento de webhook ya normalizado. `raw` se guarda tal cual en
 * webhook_events.payload para poder auditar después (regla del brief,
 * sección 3.5: "Loguear todo evento crudo").
 */
export interface WebhookEvent {
  provider: PaymentProviderName;
  /** Id único del evento — se usa para idempotencia (webhook_events.event_id) */
  eventId: string;
  /** Tipo de evento tal cual lo manda el provider (ej. "checkout.session.completed") */
  type: string;
  providerRef: string | null;
  /**
   * Estado normalizado, sólo si ESTE evento puntual lo trae (Stripe sí lo
   * trae; Mercado Pago no — su webhook sólo avisa "pasó algo con este id",
   * hay que llamar a getPaymentStatus(providerRef) para saber el estado real).
   */
  status: PaymentStatus | null;
  raw: unknown;
}

export interface PaymentProvider {
  readonly name: PaymentProviderName;

  /** Crea la sesión de pago y devuelve a dónde redirigir al cliente. */
  createCheckoutSession(order: CheckoutOrder): Promise<CheckoutSessionResult>;

  /**
   * Valida la firma del webhook y devuelve el evento normalizado.
   * Debe TIRAR (throw) si la firma no es válida — nunca procesar sin esto.
   */
  verifyWebhook(request: WebhookRequest): WebhookEvent;

  /** Consulta el estado real de un pago, por si hay que reconciliar a mano. */
  getPaymentStatus(providerRef: string): Promise<PaymentStatusResult>;

  /**
   * Busca el pago más reciente asociado a un pedido (por external_reference),
   * sin depender de ningún webhook ni de tener guardado el id del pago de
   * antemano. Pensado para el botón "Verificar pago" del panel admin — un
   * respaldo manual para cuando el aviso automático del provider no llega
   * o se demora (pasa seguido en modo de prueba de Mercado Pago).
   * `null` si todavía no hay ningún intento de pago para ese pedido.
   * Opcional: no todos los providers lo necesitan todavía (Stripe no lo usa
   * hoy porque no está conectado a ningún checkout real).
   */
  findPaymentByOrder?(
    orderId: string
  ): Promise<{ status: PaymentStatus; providerRef: string } | null>;

  /**
   * Lee la notificación SIN validar la firma.
   *
   * Existe para un caso puntual y bien acotado: cuando la firma no valida pero
   * el aviso igual puede ser legítimo, y el estado real se puede confirmar por
   * otra vía que no se puede falsificar (una llamada a la API del provider con
   * NUESTRA credencial). Es lo que pasa con el aviso automático de Mercado Pago
   * en modo de prueba.
   *
   * Quien la use tiene la obligación de NO confiar en nada de lo que devuelve
   * más allá del id del recurso, y de confirmar el estado contra el provider
   * antes de tocar un pedido. Devuelve null si no se puede sacar ni siquiera
   * un id.
   *
   * Opcional: sólo la implementa el provider que la necesita.
   */
  parseWebhookSinVerificar?(request: WebhookRequest): WebhookEvent | null;
}

/** paid/failed/pending de la base ↔ approved/rejected/pending del provider.
 * Compartido entre el webhook y el botón de verificación manual, para que
 * los dos mapeen el mismo estado de la misma forma. */
export function toDbPaymentStatus(
  status: PaymentStatus
): "paid" | "failed" | "pending" {
  if (status === "approved") return "paid";
  if (status === "rejected") return "failed";
  return "pending";
}

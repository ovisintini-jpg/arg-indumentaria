// src/lib/payments/index.ts
//
// Punto de entrada de la capa de pagos. El checkout y el webhook público
// deben importar SIEMPRE desde acá, nunca directo de providers/*, para que
// agregar un provider nuevo no toque el resto del código.

import type { PaymentProvider, PaymentProviderName } from "./types";
import { StripeProvider } from "./providers/stripe-provider";
import { MercadoPagoProvider } from "./providers/mercadopago-provider";

export * from "./types";

export function getPaymentProvider(name: PaymentProviderName): PaymentProvider {
  switch (name) {
    case "stripe":
      return new StripeProvider();
    case "mercadopago":
      return new MercadoPagoProvider();
    default: {
      const _exhaustive: never = name;
      throw new Error(`Provider de pago desconocido: ${_exhaustive}`);
    }
  }
}

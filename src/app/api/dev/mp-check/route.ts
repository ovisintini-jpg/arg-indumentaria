// src/app/api/dev/mp-check/route.ts
//
// DIAGNÓSTICO TEMPORAL de Mercado Pago — sólo responde en `npm run dev`.
// Prueba las credenciales del .env.local del lado del servidor (la clave
// nunca sale al navegador) y crea una preferencia de prueba de $100.
// Borrar esta carpeta cuando el pago ande.

import { NextResponse } from "next/server";
import { MercadoPagoConfig, Preference, User } from "mercadopago";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "no disponible" }, { status: 404 });
  }
  const token = process.env.MP_ACCESS_TOKEN ?? "";
  const appUrl = (process.env.APP_URL ?? "").replace(/\/$/, "");
  const out: Record<string, unknown> = {
    tokenCargado: Boolean(token),
    tokenPrefijo: token.slice(0, 8),
    publicKeyCargada: Boolean(process.env.MP_PUBLIC_KEY),
    webhookSecretCargado: Boolean(process.env.MP_WEBHOOK_SECRET),
    appUrl,
  };
  const cfg = new MercadoPagoConfig({ accessToken: token, options: { timeout: 8000 } });
  const detalle = (e: unknown) => {
    const x = e as { message?: string; status?: number; cause?: unknown; error?: string };
    return { message: x?.message, status: x?.status, error: x?.error, cause: x?.cause };
  };
  try {
    const me = await new User(cfg).get();
    const m = me as unknown as Record<string, unknown>;
    out.cuenta = { id: m.id, nickname: m.nickname, site_id: m.site_id, tags: m.tags, status: m.status };
  } catch (e) {
    out.cuentaError = detalle(e);
  }
  try {
    const p = await new Preference(cfg).create({
      body: {
        items: [{ id: "diag", title: "Prueba diagnóstico", quantity: 1, unit_price: 100, currency_id: "ARS" }],
        payer: { email: "test_user_diag@testuser.com" },
        external_reference: "diagnostico",
        back_urls: {
          success: `${appUrl}/checkout/mercadopago/exito`,
          pending: `${appUrl}/checkout/mercadopago/pendiente`,
          failure: `${appUrl}/checkout/mercadopago/error`,
        },
        ...(appUrl.startsWith("https://") ? { auto_return: "approved" as const } : {}),
        ...(appUrl ? { notification_url: `${appUrl}/api/webhooks/mercadopago` } : {}),
      },
    });
    out.preferencia = { ok: true, id: p.id, init_point: p.init_point };
  } catch (e) {
    out.preferenciaError = detalle(e);
  }
  const rpc = await supabase
    .rpc("get_order_for_payment", { p_order_id: "00000000-0000-0000-0000-000000000000" })
    .maybeSingle();
  out.rpcGetOrderForPayment = rpc.error
    ? { error: rpc.error.message, code: rpc.error.code, hint: rpc.error.hint }
    : { ok: true, data: rpc.data };
  const po = await supabase.rpc("place_order", {} as never);
  out.rpcPlaceOrderSinArgs = po.error ? { error: po.error.message, code: po.error.code } : "ok";
  return NextResponse.json(out);
}

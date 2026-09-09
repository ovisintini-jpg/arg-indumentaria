// src/app/api/admin/mercadopago/verificar-pago/route.ts
//
// Botón "Verificar pago" del panel admin (/admin/pedidos). Respaldo manual
// para cuando el aviso automático de Mercado Pago (el webhook) no llega o
// llega con una firma que no valida — algo que pasa seguido en modo de
// prueba (ver claude/pagos-2026-09-05.md, sección 7). Consulta directo a la
// API de Mercado Pago por external_reference, sin depender de ningún aviso
// ni de tener guardado el id del pago de antemano.
//
// A diferencia del webhook (público, sin login), este endpoint es solo para
// admins. La sesión se lee de la cookie con un cliente propio (no el
// `supabase` compartido de src/lib/supabase.ts, que del lado del servidor
// nunca lee cookies — ver nota en ese archivo). Ese mismo cliente autenticado
// es el que llama después a la función SQL: admin_actualizar_pago() vuelve a
// chequear is_admin() adentro de Postgres, así que hace falta que la llamada
// lleve la sesión real del admin — si se llamara con el cliente anónimo,
// Postgres vería auth.uid() = NULL y la rechazaría también a ella, aunque
// el chequeo de acá arriba haya dado bien.
//
// El estado real de un pedido nunca lo decide el navegador — acá tampoco:
// se confía únicamente en lo que devuelve la API de Mercado Pago con
// nuestro propio access token, jamás en nada que mande el cliente aparte
// del orderId.

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getPaymentProvider, toDbPaymentStatus } from "@/lib/payments";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Falta configurar Supabase." }, { status: 500 });
  }

  // Mismas cookieOptions que src/lib/supabase.ts y src/proxy.ts — tienen que
  // coincidir para poder leer la sesión que ya dejó el login del admin.
  const authClient = createServerClient(supabaseUrl, supabaseKey, {
    cookieOptions: {
      name: "sb-session",
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      // Sólo lee la sesión existente — no hace falta refrescarla acá.
      setAll() {},
    },
  });

  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data: adminUser } = await authClient
    .from("admin_users")
    .select("id")
    .eq("id", user.id)
    .single();
  if (!adminUser) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const orderId = body?.orderId;
  if (!orderId || typeof orderId !== "string") {
    return NextResponse.json({ error: "Falta orderId" }, { status: 400 });
  }

  const provider = getPaymentProvider("mercadopago");
  if (!provider.findPaymentByOrder) {
    return NextResponse.json(
      { error: "Este provider no soporta verificación manual." },
      { status: 400 }
    );
  }

  try {
    const encontrado = await provider.findPaymentByOrder(orderId);

    if (!encontrado) {
      return NextResponse.json({
        updated: false,
        message: "Todavía no hay ningún pago registrado para este pedido en Mercado Pago.",
      });
    }

    const nuevoEstado = toDbPaymentStatus(encontrado.status);

    const { data: actualizado, error } = await authClient.rpc("admin_actualizar_pago", {
      p_order_id: orderId,
      p_provider_ref: encontrado.providerRef,
      p_new_status: nuevoEstado,
    });

    if (error) throw new Error(error.message);

    return NextResponse.json({ updated: Boolean(actualizado), status: nuevoEstado });
  } catch (err) {
    console.error("[admin verificar-pago] error:", err);
    return NextResponse.json({ error: "No se pudo verificar el pago." }, { status: 500 });
  }
}

-- ================================================================
--  ARG INDUMENTARIA — Parche: soporte de webhooks de pago
--
--  Para: pedidos pagados con Mercado Pago (o Stripe más adelante).
--  Contexto completo en claude/pagos-2026-09-05.md del proyecto de Claude.
--
--  Qué agrega:
--    1. Tabla webhook_events — guarda cada notificación cruda que manda
--       el procesador de pagos, y sirve para no procesar el mismo evento
--       dos veces (los procesadores reintentan notificaciones).
--    2. Función record_payment_webhook() — el webhook público la llama
--       para marcar un pedido como pagado/rechazado. Corre con permisos
--       propios (SECURITY DEFINER) para no depender de que quien llama
--       esté logueado: el webhook lo llama Mercado Pago, no un cliente.
--
--  NO toca la tabla orders: payment_status, payment_method y
--  payment_reference ya existían de antes (el comentario original de
--  payment_reference ya decía "ID transacción MercadoPago, etc." — este
--  parche por fin lo usa para eso).
--
--  Correr en: Supabase Dashboard → SQL Editor → New Query.
--  Se probó contra un PostgreSQL 16 local, corrido dos veces, para
--  confirmar que no rompe nada si ya estaba corrido (podés pegarlo de
--  nuevo sin miedo si no estás seguro de si ya lo corriste).
-- ================================================================

CREATE TABLE IF NOT EXISTS public.webhook_events (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  provider     text        NOT NULL,
  event_id     text        NOT NULL,
  payload      jsonb,
  processed_at timestamptz DEFAULT now(),
  UNIQUE (provider, event_id)
);

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- Nadie lee ni escribe esta tabla directo — sólo record_payment_webhook()
-- (SECURITY DEFINER) escribe acá. Ni el panel admin ni el cliente la
-- necesitan por ahora.
REVOKE ALL ON public.webhook_events FROM anon, authenticated;

-- ----------------------------------------------------------------
-- record_payment_webhook()
--
-- Devuelve TRUE si procesó el evento de verdad, FALSE si ya lo había
-- procesado antes (idempotencia) — así el webhook puede loguear la
-- diferencia sin volver a tocar el pedido.
--
-- Nunca revierte un pedido que ya está 'paid': si un evento viejo llega
-- tarde (reintento, desorden de red) y dice 'pending' o 'failed' sobre
-- un pedido que ya se cobró, no hace nada. Evita que un reintento fuera
-- de orden le devuelva a un cliente que YA pagó el cartel de "pendiente".
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_payment_webhook(
  p_provider     text,
  p_event_id     text,
  p_payload      jsonb,
  p_order_id     uuid,
  p_provider_ref text,
  p_new_status   text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_rows integer;
BEGIN
  INSERT INTO public.webhook_events (provider, event_id, payload)
  VALUES (p_provider, p_event_id, p_payload)
  ON CONFLICT (provider, event_id) DO NOTHING;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN false; -- este evento ya se había procesado
  END IF;

  IF p_order_id IS NOT NULL THEN
    UPDATE public.orders
    SET payment_reference = p_provider_ref,
        payment_status    = p_new_status
    WHERE id = p_order_id
      AND payment_status <> 'paid';
  END IF;

  RETURN true;
END;
$function$;

ALTER FUNCTION public.record_payment_webhook(text, text, jsonb, uuid, text, text)
  SET search_path = public;

-- ----------------------------------------------------------------
-- get_order_for_payment()
--
-- La usa la API route que arma la sesión de pago, justo después de que
-- place_order() creó el pedido. Devuelve sólo lo mínimo para armar el
-- cobro (el monto SIEMPRE sale de acá, nunca de lo que mande el
-- navegador) — no expone dirección, items ni datos del cliente.
-- SECURITY DEFINER porque un pedido de invitado (sin login) no pasa la
-- policy "orders_select_own" (auth.uid() = user_id OR is_admin()).
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_order_for_payment(p_order_id uuid)
RETURNS TABLE(order_number text, total numeric, payment_status text)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT o.order_number, o.total, o.payment_status
  FROM public.orders o
  WHERE o.id = p_order_id;
$function$;

ALTER FUNCTION public.get_order_for_payment(uuid) SET search_path = public;

-- ----------------------------------------------------------------
-- get_order_status_public()
--
-- La usan las páginas de retorno (éxito/pendiente/error) después de que
-- Mercado Pago redirige al cliente de vuelta al sitio. Devuelve sólo el
-- estado — nada de montos, dirección ni items — para poder mostrar el
-- estado REAL del pedido (que define el webhook) en vez de confiar en
-- a qué página redirigió Mercado Pago.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_order_status_public(p_order_number text)
RETURNS TABLE(status text, payment_status text)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT o.status, o.payment_status
  FROM public.orders o
  WHERE o.order_number = p_order_number;
$function$;

ALTER FUNCTION public.get_order_status_public(text) SET search_path = public;

-- ================================================================
--  ARG INDUMENTARIA — Parche: botón "Verificar pago" (admin)
--
--  Contexto completo en claude/pagos-2026-09-05.md, sección 7 del proyecto
--  de Claude. Resumen: en modo de prueba, el aviso automático de Mercado
--  Pago (el webhook) a veces no llega o llega con una firma que no valida
--  — es una inconsistencia conocida del lado de Mercado Pago en sandbox,
--  no un bug de este código. Esta función es el respaldo manual: el admin
--  aprieta un botón en /admin/pedidos, y en vez de esperar el aviso, el
--  servidor consulta directo a la API de Mercado Pago (por external_reference,
--  sin necesitar tener guardado ningún id de pago de antemano) y actualiza
--  el pedido con el resultado real.
--
--  A diferencia de record_payment_webhook() (pensada para el webhook
--  público, sin login, protegida con la tabla webhook_events), esta función
--  la puede llamar cualquiera que tenga la clave anon — por eso PIDE
--  is_admin() ADENTRO de la función. No alcanza con que el endpoint de
--  Next.js chequee "es admin" antes de llamarla: si alguien llamara a esta
--  función directo (saltándose la app), tiene que rebotar igual. Por eso
--  el Next.js route que la llama usa el cliente autenticado con la cookie
--  de sesión del admin (no el cliente anónimo compartido) — si no, is_admin()
--  adentro de Postgres vería auth.uid() = NULL y rechazaría también a un
--  admin de verdad.
--
--  Probado contra un PostgreSQL 16 local con cuatro casos: caller anónimo
--  rechazado, admin actualiza un pedido pendiente, NUNCA revierte uno que
--  ya está 'paid', y re-ejecutar no rompe nada (idempotente por diseño,
--  sin necesitar ninguna tabla de eventos).
--
--  Correr en: Supabase Dashboard → SQL Editor → New Query.
-- ================================================================

CREATE OR REPLACE FUNCTION public.admin_actualizar_pago(
  p_order_id     uuid,
  p_provider_ref text,
  p_new_status   text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  UPDATE public.orders
  SET payment_reference = p_provider_ref,
      payment_status    = p_new_status
  WHERE id = p_order_id
    AND payment_status <> 'paid';

  RETURN FOUND;
END;
$function$;

ALTER FUNCTION public.admin_actualizar_pago(uuid, text, text) SET search_path = public;

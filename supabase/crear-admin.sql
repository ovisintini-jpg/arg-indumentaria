-- ================================================================
--  ARG INDUMENTARIA - Darle acceso al panel admin a tu usuario
--
--  PASO 1 (en el navegador, no aca):
--    Supabase Dashboard -> Authentication -> Users -> "Add user"
--    -> "Create new user". Poner tu email y una contrasena.
--    IMPORTANTE: tildar "Auto Confirm User", si no queda pendiente
--    de confirmacion por mail y no vas a poder loguearte.
--
--  PASO 2 (aca):
--    Pegar TODO este archivo en SQL Editor -> New query y apretar Run.
--    (Pegar solo una linea suelta da "syntax error": es una sola
--    sentencia, va entera.) Toma el id del usuario que creaste en el
--    paso 1 buscandolo por email, asi no copias ningun UUID a mano.
--
--  PASO 3:
--    Ir a  http://localhost:3000/admin  y entrar con ese email y
--    contrasena.
-- ================================================================

insert into public.admin_users (id, email, name, role)
select u.id, u.email, 'Omar', 'superadmin'
from auth.users u
where u.email = 'ovisintini@gmail.com'
on conflict (id) do update
  set role = 'superadmin',
      name = excluded.name;

-- Verificacion: tiene que devolver una fila con tu email.
select id, email, name, role from public.admin_users;

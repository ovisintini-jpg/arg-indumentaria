import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Sin credenciales todavía no hay base a la que consultar: no hay sesión que
  // validar ni datos que proteger. Antes esto redirigía /admin a la home en
  // silencio, y desde afuera parecía que el panel no existía. Ahora dejamos
  // pasar: el layout del admin muestra la pantalla que explica qué falta.
  if (!supabaseUrl || !supabaseKey) {
    return response;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookieOptions: {
        name:     "sb-session",
        path:     "/",
        sameSite: "lax",
        secure:   process.env.NODE_ENV === "production",
      },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresca la sesión en cada request
  const { data: { user } } = await supabase.auth.getUser();

  // ── Protección server-side de rutas /admin ──────────────────────────────
  // Corta acá si no hay sesión, o si la sesión existe pero no es de un
  // admin. Antes solo se chequeaba "¿hay alguien logueado?" — cualquier
  // cliente registrado (no admin) podía pasar este punto y el HTML/JS del
  // panel llegaba a cargarse en su navegador (el AdminLayout recién ahí lo
  // rebotaba). Con este chequeo agregado, una cuenta de cliente normal ni
  // siquiera pasa del servidor.
  if (request.nextUrl.pathname.startsWith("/admin")) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }

    const { data: adminUser } = await supabase
      .from("admin_users")
      .select("id")
      .eq("id", user.id)
      .single();

    if (!adminUser) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};

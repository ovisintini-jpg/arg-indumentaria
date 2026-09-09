"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Brand from "@/components/Brand";
import { Icon } from "@/components/Icons";

function Cargando({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-10">
      <span className="h-1.5 w-1.5 animate-pulse bg-acento" />
      <p className="ag-label">{label}</p>
    </div>
  );
}

function ResetPasswordForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [password,  setPass]    = useState("");
  const [confirm,   setConfirm] = useState("");
  const [error,     setError]   = useState("");
  const [success,   setSuccess] = useState(false);
  const [loading,   setLoading] = useState(false);
  const [checking,  setChecking] = useState(true);
  const [validToken, setValidToken] = useState(false);

  useEffect(() => {
    // Supabase redirecta con ?code=... (PKCE) o con el hash #access_token=...
    // El SDK de Supabase SSR maneja el intercambio automáticamente via el listener.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setValidToken(true);
        setChecking(false);
      }
    });

    // Si ya hay sesión activa con token de recovery en la URL
    const code = searchParams.get("code");
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error: err }) => {
        if (!err) {
          setValidToken(true);
        } else {
          setError("El link expiró o ya fue usado. Pedí uno nuevo desde el login.");
        }
        setChecking(false);
      });
    } else {
      // Esperar el evento PASSWORD_RECOVERY del hash
      const timeout = setTimeout(() => {
        setChecking(false);
        setError("El link no es válido o expiró. Pedí uno nuevo desde el login.");
      }, 3000);
      return () => {
        clearTimeout(timeout);
        subscription.unsubscribe();
      };
    }

    return () => subscription.unsubscribe();
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { setError("La contraseña tiene que tener al menos 6 caracteres."); return; }
    if (password !== confirm) { setError("Las contraseñas no coinciden."); return; }

    setLoading(true); setError("");
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (err) setError("No se pudo actualizar la contraseña. Probá de nuevo.");
    else setSuccess(true);
  };

  return (
    <main className="min-h-screen bg-ink">
      <div className="ag-rail" aria-hidden="true" />
      <div className="flex min-h-[calc(100vh-3px)] items-center justify-center px-4 py-14">
        <div className="w-full max-w-md border border-line bg-panel">
          <div className="px-8 py-9 md:px-10 md:py-10">

            <Brand size="md" className="mb-8" />

            <div className="ag-tick mb-4" aria-hidden="true"><i /><i /><i /></div>
            <p className="ag-eyebrow mb-2">Recuperar acceso</p>
            <h1 className="font-display text-[1.7rem] font-extrabold uppercase leading-none">
              Nueva contraseña
            </h1>

            <div className="mt-8">
              {checking ? (
                <Cargando label="Verificando el link…" />

              ) : success ? (
                <div className="text-center">
                  <span className="mx-auto mb-5 grid h-12 w-12 place-items-center border border-ok/40 text-ok">
                    <Icon name="check" size={22} />
                  </span>
                  <p className="font-display text-[1.05rem] font-extrabold uppercase">
                    Contraseña actualizada
                  </p>
                  <p className="mx-auto mt-2.5 max-w-[32ch] font-light leading-relaxed text-mute">
                    Ya podés entrar con la nueva.
                  </p>
                  <button onClick={() => router.push("/")} className="ag-btn ag-btn-acento mt-7 w-full">
                    Ir a la tienda
                  </button>
                </div>

              ) : !validToken ? (
                <div className="text-center">
                  <div className="border border-warn/40 bg-warn/10 px-5 py-4 text-left">
                    <p className="text-[0.9rem] font-light leading-relaxed text-warn">{error}</p>
                  </div>
                  <button onClick={() => router.push("/")} className="ag-btn ag-btn-ghost mt-6 w-full">
                    Volver a la tienda
                  </button>
                </div>

              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="ag-label mb-2 block">Nueva contraseña</label>
                    <input
                      type="password" value={password} onChange={(e) => setPass(e.target.value)}
                      required minLength={6} autoComplete="new-password" className="ag-input"
                    />
                    <p className="mt-1.5 text-[0.8rem] font-light text-dim">Mínimo 6 caracteres</p>
                  </div>

                  <div>
                    <label className="ag-label mb-2 block">Repetir contraseña</label>
                    <input
                      type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                      required minLength={6} autoComplete="new-password" className="ag-input"
                    />
                  </div>

                  {error && (
                    <div className="border border-sale/40 bg-sale/10 px-4 py-3">
                      <p className="text-[0.88rem] font-light text-sale">{error}</p>
                    </div>
                  )}

                  <button type="submit" disabled={loading} className="ag-btn ag-btn-acento w-full">
                    {loading ? "Actualizando…" : "Guardar contraseña"}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <main className="flex min-h-screen items-center justify-center bg-ink">
        <Cargando label="Cargando…" />
      </main>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}

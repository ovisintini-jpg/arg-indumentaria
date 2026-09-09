"use client";

import { useState, useEffect } from "react";
import { useUser } from "@/context/UserContext";
import { supabase } from "@/lib/supabase";
import { Icon } from "@/components/Icons";

type View = "login" | "register" | "forgot";

interface AuthModalProps {
  isOpen:      boolean;
  initialTab?: "login" | "register";
  onClose:     () => void;
}

/* ── Ojo para mostrar/ocultar la contraseña ─────────────────────── */
function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
  );
}

/* ── Campo de contraseña ────────────────────────────────────────── */
function PasswordField({
  label, value, onChange, show, onToggle, autoComplete, hint,
}: {
  label: string; value: string; onChange: (v: string) => void;
  show: boolean; onToggle: () => void; autoComplete: string; hint?: string;
}) {
  return (
    <div>
      <label className="ag-label mb-2 block">{label}</label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          autoComplete={autoComplete}
          className="ag-input pr-12"
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-dim transition-colors hover:text-chalk"
          tabIndex={-1}
        >
          <EyeIcon open={show} />
        </button>
      </div>
      {hint && <p className="mt-1.5 text-[0.8rem] font-light text-dim">{hint}</p>}
    </div>
  );
}

export default function AuthModal({ isOpen, initialTab = "login", onClose }: AuthModalProps) {
  const { signIn, signUp } = useUser();

  const [view,        setView]       = useState<View>(initialTab);
  const [email,       setEmail]      = useState("");
  const [password,    setPass]       = useState("");
  const [confirm,     setConfirm]    = useState("");
  const [name,        setName]       = useState("");
  const [error,       setError]      = useState("");
  const [success,     setSuccess]    = useState("");
  const [loading,     setLoading]    = useState(false);
  const [showPass,    setShowPass]   = useState(false);
  const [showConfirm, setShowConf]   = useState(false);

  useEffect(() => { setView(initialTab); }, [initialTab, isOpen]);

  const resetForm = () => {
    setEmail(""); setPass(""); setConfirm(""); setName("");
    setError(""); setSuccess(""); setLoading(false);
    setShowPass(false); setShowConf(false);
  };

  const handleClose = () => { resetForm(); onClose(); };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    const err = await signIn(email, password);
    if (err) setError("Email o contraseña incorrectos.");
    else handleClose();
    setLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("El nombre es obligatorio."); return; }
    if (password !== confirm) { setError("Las contraseñas no coinciden."); return; }
    setLoading(true); setError("");
    const err = await signUp(email, password, name);
    if (err) setError(err.includes("already") ? "Ese email ya tiene una cuenta." : err);
    else setSuccess("¡Cuenta creada! Revisá tu email para confirmarla.");
    setLoading(false);
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setError("Ingresá tu email."); return; }
    setLoading(true); setError("");
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (err) setError("No pudimos enviar el email. Verificá la dirección.");
    else setSuccess("Listo. Revisá tu bandeja de entrada y seguí el link.");
  };

  const goTo = (v: View) => { resetForm(); setView(v); };

  if (!isOpen) return null;

  const titulo =
    view === "login"    ? "Entrar a tu cuenta" :
    view === "register" ? "Crear una cuenta"   :
                          "Recuperar contraseña";

  const bajada =
    view === "login"    ? "Tus pedidos, tus datos de envío y tu historial de compras." :
    view === "register" ? "Guardá tu dirección una vez y seguí tus pedidos." :
                          "Te mandamos un link por email para que elijas una nueva.";

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm" onClick={handleClose} />

      <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="pointer-events-auto flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden border border-line bg-panel">
          <div className="ag-rail shrink-0" aria-hidden="true" />

          {/* Encabezado */}
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-7 py-6">
            <div>
              <div className="ag-tick mb-3" aria-hidden="true"><i /><i /><i /></div>
              <h2 className="font-display text-[1.3rem] font-extrabold uppercase tracking-[-0.02em]">
                {titulo}
              </h2>
              <p className="mt-1.5 max-w-[38ch] text-[0.85rem] font-light leading-relaxed text-mute">
                {bajada}
              </p>
            </div>
            <button
              onClick={handleClose}
              aria-label="Cerrar"
              className="grid h-9 w-9 shrink-0 place-items-center border border-line text-mute transition-colors hover:border-linehi hover:text-chalk"
            >
              <Icon name="close" size={16} />
            </button>
          </div>

          {/* Solapas */}
          {view !== "forgot" && !success && (
            <div className="flex shrink-0 border-b border-line">
              {(["login", "register"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => goTo(t)}
                  className={`flex-1 border-b-2 py-3.5 font-cond text-[0.88rem] font-semibold uppercase tracking-[0.18em] transition-colors ${
                    view === t
                      ? "border-b-acento text-chalk"
                      : "border-b-transparent text-dim hover:text-mute"
                  }`}
                >
                  {t === "login" ? "Ingresar" : "Crear cuenta"}
                </button>
              ))}
            </div>
          )}

          {/* Contenido */}
          <div className="custom-scrollbar flex-1 overflow-y-auto px-7 py-7">

            {success ? (
              <div className="py-6 text-center">
                <span className="mx-auto mb-4 grid h-12 w-12 place-items-center border border-ok/40 text-ok">
                  <Icon name="check" size={22} />
                </span>
                <p className="mx-auto max-w-[34ch] font-light leading-relaxed text-mute">{success}</p>
                <button onClick={() => goTo("login")} className="ag-btn ag-btn-ghost ag-btn-sm mt-7">
                  Ir a iniciar sesión
                </button>
              </div>

            ) : view === "login" ? (
              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="ag-label mb-2 block">Email</label>
                  <input
                    type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    required autoComplete="email" className="ag-input"
                  />
                </div>

                <div>
                  <div className="mb-2 flex items-baseline justify-between gap-3">
                    <label className="ag-label">Contraseña</label>
                    <button
                      type="button"
                      onClick={() => goTo("forgot")}
                      className="font-cond text-[0.75rem] font-semibold uppercase tracking-[0.14em] text-dim transition-colors hover:text-acentohi"
                    >
                      La olvidé
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPass ? "text" : "password"} value={password}
                      onChange={(e) => setPass(e.target.value)}
                      required autoComplete="current-password" className="ag-input pr-12"
                    />
                    <button
                      type="button" onClick={() => setShowPass(!showPass)} tabIndex={-1}
                      aria-label={showPass ? "Ocultar contraseña" : "Mostrar contraseña"}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-dim transition-colors hover:text-chalk"
                    >
                      <EyeIcon open={showPass} />
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="border border-sale/40 bg-sale/10 px-4 py-3">
                    <p className="text-[0.88rem] font-light text-sale">{error}</p>
                  </div>
                )}

                <button type="submit" disabled={loading} className="ag-btn ag-btn-acento w-full">
                  {loading ? "Verificando…" : "Ingresar"}
                </button>

                <p className="text-center text-[0.88rem] font-light text-mute">
                  ¿Todavía no tenés cuenta?{" "}
                  <button
                    type="button" onClick={() => goTo("register")}
                    className="text-acentohi transition-colors hover:text-chalk"
                  >
                    Creá una
                  </button>
                </p>
              </form>

            ) : view === "register" ? (
              <form onSubmit={handleRegister} className="space-y-5">
                <div>
                  <label className="ag-label mb-2 block">Nombre completo</label>
                  <input
                    type="text" value={name} onChange={(e) => setName(e.target.value)}
                    required autoComplete="name" className="ag-input"
                  />
                </div>

                <div>
                  <label className="ag-label mb-2 block">Email</label>
                  <input
                    type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    required autoComplete="email" className="ag-input"
                  />
                </div>

                <PasswordField
                  label="Contraseña" value={password} onChange={setPass}
                  show={showPass} onToggle={() => setShowPass(!showPass)}
                  autoComplete="new-password" hint="Mínimo 6 caracteres"
                />

                <PasswordField
                  label="Repetir contraseña" value={confirm} onChange={setConfirm}
                  show={showConfirm} onToggle={() => setShowConf(!showConfirm)}
                  autoComplete="new-password"
                />

                {error && (
                  <div className="border border-sale/40 bg-sale/10 px-4 py-3">
                    <p className="text-[0.88rem] font-light text-sale">{error}</p>
                  </div>
                )}

                <button type="submit" disabled={loading} className="ag-btn ag-btn-acento w-full">
                  {loading ? "Creando…" : "Crear cuenta"}
                </button>

                <p className="text-center text-[0.88rem] font-light text-mute">
                  ¿Ya tenés cuenta?{" "}
                  <button
                    type="button" onClick={() => goTo("login")}
                    className="text-acentohi transition-colors hover:text-chalk"
                  >
                    Ingresá
                  </button>
                </p>
              </form>

            ) : (
              <form onSubmit={handleForgot} className="space-y-5">
                <div>
                  <label className="ag-label mb-2 block">Email</label>
                  <input
                    type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    required autoComplete="email" className="ag-input"
                  />
                </div>

                {error && (
                  <div className="border border-sale/40 bg-sale/10 px-4 py-3">
                    <p className="text-[0.88rem] font-light text-sale">{error}</p>
                  </div>
                )}

                <button type="submit" disabled={loading} className="ag-btn ag-btn-acento w-full">
                  {loading ? "Enviando…" : "Enviar el link"}
                </button>

                <button type="button" onClick={() => goTo("login")} className="ag-btn ag-btn-ghost ag-btn-sm w-full">
                  ← Volver
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

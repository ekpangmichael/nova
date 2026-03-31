"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthClientError, signInWithPassword, signUpWithPassword } from "@/lib/auth-client";

type AuthMode = "signin" | "signup";

const getSubmitLabel = (mode: AuthMode, isPending: boolean) => {
  if (isPending) {
    return mode === "signup" ? "Creating account..." : "Signing in...";
  }

  return mode === "signup" ? "Create account" : "Sign in";
};

export default function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const isSignUp = mode === "signup";
  const authError = searchParams.get("error");

  useEffect(() => {
    if (!authError) {
      return;
    }

    const messageMap: Record<string, string> = {
      google_not_configured:
        "Google login is not configured yet. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET first.",
      google_cancelled: "Google sign-in was cancelled before completion.",
      google_state_invalid:
        "Google sign-in could not be verified. Please try again.",
      google_callback_failed:
        "Google sign-in failed while creating the Nova session. Try again.",
    };

    setErrorMessage(messageMap[authError] ?? "Authentication failed. Try again.");
  }, [authError]);

  const canSubmit = useMemo(() => {
    if (!email.trim() || password.length < 8 || isPending) {
      return false;
    }

    if (isSignUp) {
      return Boolean(name.trim()) && password === confirmPassword;
    }

    return true;
  }, [confirmPassword, email, isPending, isSignUp, name, password]);

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setErrorMessage(null);
    setStatusMessage(null);
  };

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);

    if (isSignUp && password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setIsPending(true);

    try {
      if (isSignUp) {
        await signUpWithPassword({
          displayName: name.trim(),
          email: email.trim(),
          password,
        });
        setStatusMessage("Account created. Redirecting to the dashboard...");
      } else {
        await signInWithPassword({
          email: email.trim(),
          password,
        });
        setStatusMessage("Signed in. Redirecting to the dashboard...");
      }

      router.push("/");
      router.refresh();
    } catch (error) {
      if (error instanceof AuthClientError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Authentication failed. Try again.");
      }
    } finally {
      setIsPending(false);
    }
  }

  return (
    <>
      <div className="mb-10 flex flex-col items-center anim-1">
        <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-sm bg-on-surface">
          <span
            className="material-symbols-outlined text-xl text-surface"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            terminal
          </span>
        </div>
        <h1 className="font-headline text-2xl font-extrabold tracking-tighter text-on-surface">
          Nova
        </h1>
        <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-on-surface-variant/50">
          Protocol // Auth Gateway
        </p>
      </div>

      <div
        className="ghost relative overflow-hidden rounded-lg anim-2"
        style={{
          background: "rgba(19, 19, 21, 0.6)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div className="ghost-b flex items-center justify-between px-6 pb-4 pt-5">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-tertiary shadow-[0_0_8px_rgba(209,255,215,0.4)]" />
            <span className="font-mono text-[10px] tracking-wide text-tertiary/70">
              SECURE_CHANNEL
            </span>
          </div>
          <span className="font-mono text-[10px] tracking-wide text-on-surface-variant/30">
            NODE: AUTH.01
          </span>
        </div>

        <div className="flex gap-1 px-6 pt-4">
          <button
            type="button"
            onClick={() => switchMode("signin")}
            className={`rounded-sm px-4 py-2 text-[11px] font-semibold tracking-tight transition-colors ${
              !isSignUp
                ? "bg-surface-container-high/60 text-on-surface"
                : "text-on-surface-variant/30 hover:text-on-surface-variant/60"
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => switchMode("signup")}
            className={`rounded-sm px-4 py-2 text-[11px] font-semibold tracking-tight transition-colors ${
              isSignUp
                ? "bg-surface-container-high/60 text-on-surface"
                : "text-on-surface-variant/30 hover:text-on-surface-variant/60"
            }`}
          >
            Create account
          </button>
        </div>

        <div className="space-y-5 px-6 pb-6 pt-5">
          <a
            href="/api/auth/google/start"
            className="flex w-full items-center justify-center gap-3 rounded-sm bg-on-surface px-4 py-3 text-sm font-semibold text-surface transition-opacity hover:opacity-90 active:scale-[0.98]"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="currentColor"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="currentColor"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="currentColor"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="currentColor"
              />
            </svg>
            <span className="font-headline tracking-tight">
              {isSignUp ? "Sign up with Google" : "Sign in with Google"}
            </span>
          </a>

          <div className="relative flex items-center py-1">
            <div className="flex-grow border-t border-outline-variant/15" />
            <span className="mx-4 flex-shrink font-mono text-[9px] uppercase tracking-[0.2em] text-on-surface-variant/25">
              or continue with email
            </span>
            <div className="flex-grow border-t border-outline-variant/15" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div className="space-y-1.5 anim-1">
                <label className="ml-1 font-mono text-[10px] uppercase tracking-wider text-on-surface-variant/40">
                  Operator Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="w-full rounded-sm border border-outline-variant/15 bg-surface-container-lowest/80 px-4 py-3 font-mono text-sm text-on-surface outline-none transition-all placeholder:text-on-surface-variant/20 focus:border-secondary/40 focus:ring-1 focus:ring-secondary/40"
                  placeholder="Jane Doe"
                  autoComplete="name"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="ml-1 font-mono text-[10px] uppercase tracking-wider text-on-surface-variant/40">
                {isSignUp ? "Email Address" : "Identity Vector"}
              </label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-sm border border-outline-variant/15 bg-surface-container-lowest/80 px-4 py-3 font-mono text-sm text-on-surface outline-none transition-all placeholder:text-on-surface-variant/20 focus:border-secondary/40 focus:ring-1 focus:ring-secondary/40"
                placeholder="operator@protocol.internal"
                autoComplete="email"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between px-1">
                <label className="font-mono text-[10px] uppercase tracking-wider text-on-surface-variant/40">
                  {isSignUp ? "Password" : "Access Cipher"}
                </label>
                {!isSignUp && (
                  <span className="font-mono text-[10px] text-on-surface-variant/20">
                    Min 8 chars
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-sm border border-outline-variant/15 bg-surface-container-lowest/80 px-4 py-3 pr-11 font-mono text-sm text-on-surface outline-none transition-all placeholder:text-on-surface-variant/20 focus:border-secondary/40 focus:ring-1 focus:ring-secondary/40"
                  placeholder="••••••••••"
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant/25 transition-colors hover:text-on-surface-variant/50"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                    {showPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
            </div>

            {isSignUp && (
              <div className="space-y-1.5 anim-1">
                <label className="ml-1 font-mono text-[10px] uppercase tracking-wider text-on-surface-variant/40">
                  Confirm Password
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="w-full rounded-sm border border-outline-variant/15 bg-surface-container-lowest/80 px-4 py-3 font-mono text-sm text-on-surface outline-none transition-all placeholder:text-on-surface-variant/20 focus:border-secondary/40 focus:ring-1 focus:ring-secondary/40"
                  placeholder="Repeat password"
                  autoComplete="new-password"
                />
              </div>
            )}

            {errorMessage ? (
              <div className="rounded-sm border border-red-400/20 bg-red-500/5 px-4 py-3 text-sm text-red-200/90">
                {errorMessage}
              </div>
            ) : null}

            {statusMessage ? (
              <div className="rounded-sm border border-tertiary/20 bg-tertiary/5 px-4 py-3 text-sm text-tertiary">
                {statusMessage}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={!canSubmit}
              className="group mt-1 flex w-full items-center justify-center gap-2 rounded-sm border border-outline-variant/20 bg-surface-container-high/60 py-3 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-bright/60 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="font-headline tracking-tight">
                {getSubmitLabel(mode, isPending)}
              </span>
              <span
                className="material-symbols-outlined text-sm text-on-surface-variant/40 transition-transform group-hover:translate-x-0.5"
                style={{ fontSize: 16 }}
              >
                arrow_forward
              </span>
            </button>
          </form>
        </div>
      </div>

      <div className="mt-8 space-y-4 text-center anim-3">
        <p className="font-mono text-[11px] tracking-tight text-on-surface-variant/35">
          {isSignUp ? (
            <>
              Already have access?{" "}
              <button
                type="button"
                onClick={() => switchMode("signin")}
                className="font-semibold text-on-surface/70 underline decoration-outline-variant/30 underline-offset-4 transition-colors hover:text-secondary"
              >
                Sign in
              </button>
            </>
          ) : (
            <>
              No access yet?{" "}
              <button
                type="button"
                onClick={() => switchMode("signup")}
                className="font-semibold text-on-surface/70 underline decoration-outline-variant/30 underline-offset-4 transition-colors hover:text-secondary"
              >
                Create account
              </button>
            </>
          )}
        </p>
        <div className="flex items-center justify-center gap-6 pt-2">
          <a
            href="#"
            className="font-mono text-[9px] uppercase tracking-[0.2em] text-on-surface-variant/25 transition-colors hover:text-on-surface-variant/50"
          >
            Privacy
          </a>
          <span className="h-1 w-1 rounded-full bg-outline-variant/20" />
          <a
            href="#"
            className="font-mono text-[9px] uppercase tracking-[0.2em] text-on-surface-variant/25 transition-colors hover:text-on-surface-variant/50"
          >
            Terms
          </a>
        </div>
      </div>
    </>
  );
}

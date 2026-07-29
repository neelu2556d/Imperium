"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import AuthCard from "@/components/auth/AuthCard";
import AuthField from "@/components/auth/AuthField";
import {
  signInWithEmailOnly,
  postSignInDestination,
  type AuthFieldError,
} from "@/lib/supabase/auth";
import { supabase } from "@/lib/supabase/client";
import { pushToast } from "@/lib/toast";

interface FieldErrors {
  email?: string;
  form?: string;
}

/**
 * Returns the full URL for the OAuth redirect. In production this uses the
 * site URL; in dev it falls back to localhost:3000 (the default Next.js port).
 */
function oauthRedirectUrl(): string {
  // Use NEXT_PUBLIC_SITE_URL if set (Vercel / production), otherwise derive
  // from the current origin. The fallback is used when the env var is absent.
  return `${
    process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin
  }/auth/callback`;
}

export default function SignInScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    const trimmed = email.trim();
    if (!trimmed) {
      setErrors({ email: "Enter your email" });
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(trimmed)) {
      setErrors({ email: "Enter a valid email address" });
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      await signInWithEmailOnly(trimmed);

      setSuccess(true);
      pushToast("Successfully logged in");

      const destination = await postSignInDestination();

      router.replace(destination);
      router.refresh();
    } catch (err) {
      const authErr = err as AuthFieldError;
      setErrors(
        authErr.field === "email"
          ? { email: authErr.message }
          : { form: authErr.message }
      );
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (googleBusy) return;
    setGoogleBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: oauthRedirectUrl(),
        },
      });
      if (error) throw error;
      // The page will redirect away — no state change needed here.
    } catch {
      setGoogleBusy(false);
      pushToast("Couldn't start Google sign-in. Try again.");
    }
  };

  return (
    <AuthCard heading="Welcome back">
      {/* Google sign-in — primary CTA */}
      <button
        type="button"
        className="btn-primary mt-7 w-full flex items-center justify-center gap-3"
        disabled={googleBusy}
        onClick={handleGoogleSignIn}
      >
        {googleBusy ? (
          "Starting sign-in…"
        ) : (
          <>
            <GoogleIcon />
            Continue with Google
          </>
        )}
      </button>

      {/* Divider */}
      <div className="relative my-5 flex items-center gap-3">
        <div
          className="h-px flex-1"
          style={{ background: "var(--color-border)" }}
          aria-hidden
        />
        <span
          className="mono text-[0.62rem] uppercase tracking-[0.14em]"
          style={{ color: "var(--color-muted)" }}
        >
          or with email
        </span>
        <div
          className="h-px flex-1"
          style={{ background: "var(--color-border)" }}
          aria-hidden
        />
      </div>

      {/* Email-only sign-in */}
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <AuthField
          id="signin-email"
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
        />

        {errors.form && (
          <p className="vt-field-error" role="alert">
            {errors.form}
          </p>
        )}

        {success && (
          <p
            className="text-center text-sm"
            style={{ color: "var(--color-mint)" }}
            role="status"
          >
            ✓ Successfully logged in — taking you in…
          </p>
        )}

        <button
          type="submit"
          className="btn-primary mt-1 w-full"
          disabled={submitting}
        >
          {success ? "Successfully logged in ✓" : submitting ? "Signing in…" : "Continue →"}
        </button>
      </form>

      <p className="text-muted mt-6 text-center text-sm">
        Or just enter your email — we&rsquo;ll sign you in or create your account.
      </p>
    </AuthCard>
  );
}

// ---------------------------------------------------------------------------
// Google SVG icon (inline, no external dependencies)
// ---------------------------------------------------------------------------

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

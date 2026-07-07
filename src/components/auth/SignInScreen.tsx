"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthCard from "@/components/auth/AuthCard";
import AuthField from "@/components/auth/AuthField";
import {
  signIn,
  postSignInDestination,
  type AuthFieldError,
} from "@/lib/supabase/auth";

interface FieldErrors {
  email?: string;
  password?: string;
  form?: string;
}

export default function SignInScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    const next: FieldErrors = {};
    if (!email.trim()) next.email = "Enter your email";
    if (!password) next.password = "Enter your password";

    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
      // Skip onboarding when all 4 steps are done; otherwise resume it.
      const destination = await postSignInDestination();
      router.replace(destination);
      router.refresh();
    } catch (err) {
      const authErr = err as AuthFieldError;
      setErrors({ [authErr.field]: authErr.message });
      setSubmitting(false);
    }
  };

  return (
    <AuthCard heading="Welcome back">
      <form onSubmit={handleSubmit} noValidate className="mt-7 flex flex-col gap-4">
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
        <AuthField
          id="signin-password"
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
        />

        {errors.form && (
          <p className="vt-field-error" role="alert">
            {errors.form}
          </p>
        )}

        <button
          type="submit"
          className="btn-primary mt-1 w-full"
          disabled={submitting}
        >
          {submitting ? "Signing in…" : "Sign in →"}
        </button>
      </form>

      <div className="text-muted mt-6 flex flex-col items-center gap-2 text-center text-sm">
        <p>
          New here?{" "}
          <Link href="/auth/signup" className="link">
            Create an account →
          </Link>
        </p>
        <Link href="/auth/forgot-password" className="link">
          Forgot password?
        </Link>
      </div>
    </AuthCard>
  );
}

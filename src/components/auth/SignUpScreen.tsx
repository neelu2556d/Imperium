"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthCard from "@/components/auth/AuthCard";
import AuthField from "@/components/auth/AuthField";
import { signUp, type AuthFieldError } from "@/lib/supabase/auth";

interface FieldErrors {
  email?: string;
  password?: string;
  confirm?: string;
  form?: string;
}

export default function SignUpScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    // Client-side validation first — clears any stale server errors.
    const next: FieldErrors = {};
    if (!email.trim()) next.email = "Enter your email";
    if (!password) next.password = "Enter a password";
    if (password && password.length < 6)
      next.password = "Use at least 6 characters";
    if (confirm !== password) next.confirm = "Passwords don't match";

    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      await signUp(email.trim(), password);
      router.replace("/onboarding/setup");
      router.refresh();
    } catch (err) {
      const authErr = err as AuthFieldError;
      setErrors({ [authErr.field]: authErr.message });
      setSubmitting(false);
    }
  };

  return (
    <AuthCard heading="Create your account">
      <form onSubmit={handleSubmit} noValidate className="mt-7 flex flex-col gap-4">
        <AuthField
          id="signup-email"
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
          id="signup-password"
          label="Password"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
        />
        <AuthField
          id="signup-confirm"
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={errors.confirm}
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
          {submitting ? "Creating…" : "Create account →"}
        </button>
      </form>

      <p className="text-muted mt-6 text-center text-sm">
        Already have an account?{" "}
        <Link href="/auth/signin" className="link">
          Sign in →
        </Link>
      </p>
    </AuthCard>
  );
}

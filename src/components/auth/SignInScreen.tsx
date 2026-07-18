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
import { pushToast } from "@/lib/toast";

interface FieldErrors {
  email?: string;
  form?: string;
}

export default function SignInScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

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
      // Skip onboarding when all 4 steps are done; otherwise resume it.
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
        Just enter your email — we&rsquo;ll sign you in or create your account.
      </p>
    </AuthCard>
  );
}

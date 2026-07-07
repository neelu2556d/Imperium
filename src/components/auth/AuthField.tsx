import type { InputHTMLAttributes } from "react";

interface AuthFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** Inline error shown beneath the input; also toggles the danger styling. */
  error?: string | null;
}

/**
 * One labelled input plus its inline error slot. The error renders as small
 * red text below the field (never an alert), and the input picks up the
 * `.vt-input-error` danger border while an error is present.
 */
export default function AuthField({
  label,
  error,
  id,
  className = "",
  ...inputProps
}: AuthFieldProps) {
  const errorId = error && id ? `${id}-error` : undefined;

  return (
    <label className="block">
      <span className="text-muted-strong mb-1.5 block text-xs font-medium">
        {label}
      </span>
      <input
        id={id}
        className={`w-full ${error ? "vt-input-error" : ""} ${className}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        {...inputProps}
      />
      {error && (
        <p id={errorId} className="vt-field-error" role="alert">
          {error}
        </p>
      )}
    </label>
  );
}

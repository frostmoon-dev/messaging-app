"use client";

import { useActionState } from "react";
import { signIn, type SignInState } from "@/lib/auth/actions";
import { Wordmark } from "@/components/ui/Wordmark";
import { Button } from "@/components/ui/Button";
import { fieldClass, labelClass } from "@/components/ui/field";

const initial: SignInState = { error: null, email: "" };

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, initial);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <section className="w-full max-w-sm" aria-labelledby="login-title">
        <Wordmark className="mb-8" />
        <h1 id="login-title" className="text-heading font-bold">
          Sign in
        </h1>
        <p className="mt-1 text-small text-muted">Use the account that was set up for you.</p>

        <form action={action} className="mt-6 flex flex-col gap-4" noValidate>
          <div>
            <label htmlFor="email" className={labelClass}>
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              defaultValue={state.email}
              className={fieldClass}
              aria-invalid={state.error ? true : undefined}
              aria-describedby={state.error ? "login-error" : undefined}
            />
          </div>
          <div>
            <label htmlFor="password" className={labelClass}>
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className={fieldClass}
              aria-invalid={state.error ? true : undefined}
              aria-describedby={state.error ? "login-error" : undefined}
            />
          </div>

          {state.error && (
            <p id="login-error" role="alert" className="text-small text-danger">
              {state.error}
            </p>
          )}

          <Button type="submit" disabled={pending} className="mt-2 w-full">
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </section>
    </main>
  );
}

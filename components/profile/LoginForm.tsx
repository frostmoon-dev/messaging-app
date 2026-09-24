"use client";

import { AlertIcon } from "@/components/ui/icons";
import { useActionState } from "react";
import { signIn, type SignInState } from "@/lib/auth/actions";
import { Wordmark } from "@/components/ui/Wordmark";
import { DayClock } from "@/components/ui/DayClock";
import { Button } from "@/components/ui/Button";
import { fieldClass, labelClass } from "@/components/ui/field";

const initial: SignInState = { error: null, email: "" };

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, initial);

  return (
    <main className="flex min-h-dvh flex-col bg-background px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-10">
      <div className="flex items-center justify-between gap-4 py-2">
        <Wordmark />
        <DayClock className="hidden sm:flex" />
      </div>

      <section className="m-auto w-full max-w-sm" aria-labelledby="login-title">
        <h1 id="login-title" className="page-title text-display">
          Sign in
        </h1>
        <span className="ink-stroke mt-3" aria-hidden="true" />
        <div className="card mt-6 bg-panel p-6 sm:p-7">
          <p className="text-body text-muted-strong">A private line for two people.</p>

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
              <p id="login-error" role="alert" className="flex items-center gap-2.5 rounded-xl bg-panel-strong px-3 py-2.5 text-small">
                <AlertIcon size={20} className="shrink-0 text-danger" />
                {state.error}
              </p>
            )}

            <Button type="submit" disabled={pending} className="mt-2 w-full">
              {pending ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </div>
      </section>
    </main>
  );
}

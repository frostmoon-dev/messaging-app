"use client";

import { useActionState } from "react";
import { signIn, type SignInState } from "@/lib/auth/actions";
import { Wordmark } from "@/components/ui/Wordmark";
import { DayClock } from "@/components/ui/DayClock";
import { UiMark } from "@/components/ui/UiMark";
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

      <section className="m-auto w-full max-w-sm rounded-card bg-panel p-6 sm:p-7" aria-labelledby="login-title">
        <h1 id="login-title" className="title-caps flex items-center gap-2 text-display">
          <UiMark name="slash" className="h-9 w-7 bg-accent" />
          Sign in
        </h1>
        <p className="mt-3 text-body text-muted-strong">A private line for two people.</p>

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
            <p id="login-error" role="alert" className="flex items-center gap-2.5 rounded-control bg-panel-strong px-3 py-2.5 text-small">
              <UiMark name="alert" className="size-6 bg-danger" />
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

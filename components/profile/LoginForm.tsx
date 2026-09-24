"use client";

import { AlertIcon } from "@/components/ui/icons";
import { useActionState } from "react";
import { signIn, type SignInState } from "@/lib/auth/actions";
import { APP_NAME } from "@/lib/app";
import { Button } from "@/components/ui/Button";
import { fieldClass, labelClass } from "@/components/ui/field";

const initial: SignInState = { error: null, email: "" };

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, initial);

  return (
    // Centred on the screen, with the icon where the start-up screen had it,
    // so opening the app flows straight into signing in.
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <section className="flex w-full max-w-sm flex-col items-center" aria-labelledby="login-title">
        {/* eslint-disable-next-line @next/next/no-img-element -- static brand image */}
        <img src="/brand-mark@4x.png" alt="" width={96} height={96} className="size-24" />
        <p className="mt-3 text-title font-extrabold">{APP_NAME}</p>
        <h1 id="login-title" className="page-title mt-8 text-heading">
          Sign in
        </h1>
        <span className="ink-stroke mt-3" aria-hidden="true" />
        <p className="mt-3 text-center text-body text-muted-strong">A private line for two people.</p>

        <div className="card mt-8 w-full bg-panel p-6">

          <form action={action} className="flex flex-col gap-4" noValidate>
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

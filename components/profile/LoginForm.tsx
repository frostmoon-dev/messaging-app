"use client";

import { useActionState } from "react";
import { motion, MotionConfig } from "framer-motion";
import { signIn, type SignInState } from "@/lib/auth/actions";
import { Wordmark } from "@/components/ui/Wordmark";

const initial: SignInState = { error: null, email: "" };

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, initial);

  return (
    <MotionConfig reducedMotion="user">
      <main className="bg-texture grain relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
        {/* Big diagonal slab behind the card. */}
        <motion.div
          initial={{ x: "-110%" }}
          animate={{ x: 0 }}
          transition={{ duration: 0.35, ease: [0.2, 0.9, 0.1, 1] }}
          className="absolute top-[24%] left-1/2 h-40 w-[160vw] -translate-x-1/2 -translate-y-1/2 -rotate-[14deg] bg-accent sm:top-[30%] sm:h-56"
          aria-hidden="true"
        />
        <motion.div
          initial={{ x: "110%" }}
          animate={{ x: 0 }}
          transition={{ duration: 0.35, delay: 0.05, ease: [0.2, 0.9, 0.1, 1] }}
          className="absolute top-[calc(24%+5.5rem)] left-1/2 h-3 w-[160vw] -translate-x-1/2 -rotate-[14deg] bg-foreground sm:top-[calc(30%+7.5rem)]"
          aria-hidden="true"
        />

        <motion.section
          initial={{ opacity: 0, y: 24, rotate: -2 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          transition={{ duration: 0.3, delay: 0.15, ease: [0.2, 0.9, 0.1, 1] }}
          className="cut-corners relative w-full max-w-sm bg-background-raised p-7 shadow-[8px_8px_0_#000]"
          aria-labelledby="login-title"
        >
          <Wordmark className="mb-6" />
          <h1 id="login-title" className="text-display text-5xl">
            Sign in
          </h1>
          <p className="mt-2 text-sm text-muted-strong">Private line. Two people. That&apos;s it.</p>

          <form action={action} className="mt-7 flex flex-col gap-4" noValidate>
            <div>
              <label htmlFor="email" className="text-display mb-1.5 block text-xs tracking-[0.25em] text-muted-strong">
                E-mail
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                defaultValue={state.email}
                className="w-full border border-border bg-panel px-3.5 py-3 text-[16px] outline-none focus:border-accent"
                aria-invalid={state.error ? true : undefined}
                aria-describedby={state.error ? "login-error" : undefined}
              />
            </div>
            <div>
              <label htmlFor="password" className="text-display mb-1.5 block text-xs tracking-[0.25em] text-muted-strong">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="w-full border border-border bg-panel px-3.5 py-3 text-[16px] outline-none focus:border-accent"
                aria-invalid={state.error ? true : undefined}
                aria-describedby={state.error ? "login-error" : undefined}
              />
            </div>

            {state.error && (
              <motion.p
                id="login-error"
                role="alert"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className="border-l-4 border-accent bg-panel px-3 py-2 text-sm"
              >
                {state.error}
              </motion.p>
            )}

            <motion.button
              type="submit"
              disabled={pending}
              whileTap={{ scale: 0.97, x: 2 }}
              className="shape-slant text-display mt-2 min-h-12 bg-accent text-lg tracking-[0.2em] text-accent-foreground transition-colors hover:bg-accent-strong disabled:opacity-60"
            >
              {pending ? "Connecting…" : "Enter"}
            </motion.button>
          </form>
        </motion.section>
      </main>
    </MotionConfig>
  );
}

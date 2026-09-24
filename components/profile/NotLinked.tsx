import { signOut } from "@/lib/auth/actions";
import { Wordmark } from "@/components/ui/Wordmark";

/** Signed in, but the account is not one of the two authorised members. */
export function NotLinked({ email }: { email: string | null }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <Wordmark className="mb-4" />
      <h1 className="text-heading font-bold">This account isn&apos;t linked</h1>
      <p className="max-w-sm text-small text-muted-strong">
        {email ? <>The account <strong className="text-foreground">{email}</strong> is not</> : "This account is not"} part
        of a conversation yet. Run the setup script to link the two accounts, then sign in again.
      </p>
      <form action={signOut}>
        <button
          type="submit"
          className="min-h-11 rounded-control bg-accent px-4 font-semibold text-accent-foreground hover:bg-accent-strong"
        >
          Sign out
        </button>
      </form>
    </main>
  );
}

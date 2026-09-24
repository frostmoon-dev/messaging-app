import { signOut } from "@/lib/auth/actions";
import { Wordmark } from "@/components/ui/Wordmark";

/** Signed in, but the account is not one of the two authorised members. */
export function NotLinked({ email }: { email: string | null }) {
  return (
    <main className="bg-texture flex min-h-dvh flex-col items-center justify-center gap-6 p-6 text-center">
      <Wordmark />
      <h1 className="text-display text-4xl">No line here</h1>
      <p className="max-w-sm text-sm text-muted-strong">
        {email ? <>The account <strong className="text-foreground">{email}</strong> isn&apos;t</> : "This account isn't"} part
        of a private conversation. Run the setup script to link the two accounts.
      </p>
      <form action={signOut}>
        <button type="submit" className="shape-slant text-display min-h-11 bg-accent px-6 tracking-wider text-accent-foreground">
          Sign out
        </button>
      </form>
    </main>
  );
}

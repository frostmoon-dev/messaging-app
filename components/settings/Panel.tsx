/** A titled Settings card. */
export function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  // aria-labelledby takes a space-separated list of ids, so ids can't contain spaces.
  const id = `section-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <section className="card bg-panel p-4 sm:p-5" aria-labelledby={id}>
      <h2 id={id} className="mb-4 text-title font-bold">
        {title}
      </h2>
      {children}
    </section>
  );
}

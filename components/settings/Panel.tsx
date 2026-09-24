/** A titled Settings card. */
export function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  // aria-labelledby takes a space-separated list of ids, so ids can't contain spaces.
  const id = `section-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <section className="p5-panel bg-panel p-4 sm:p-5" aria-labelledby={id}>
      <h2 id={id} className="mb-4 flex items-center gap-2.5 text-title font-bold">
        <span className="p5-button h-5 w-2.5 bg-accent" aria-hidden="true" />
        {title}
      </h2>
      {children}
    </section>
  );
}

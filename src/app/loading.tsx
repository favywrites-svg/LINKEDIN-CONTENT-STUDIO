export default function Loading() {
  return (
    <div className="space-y-5 py-2 animate-pulse">
      <div className="h-8 w-56 rounded-lg bg-surface-subtle" />
      <div className="h-4 w-96 max-w-full rounded bg-surface-subtle" />
      <div className="grid gap-4 pt-2 md:grid-cols-2">
        <div className="h-44 rounded-xl border border-border bg-surface" />
        <div className="h-44 rounded-xl border border-border bg-surface" />
      </div>
    </div>
  );
}

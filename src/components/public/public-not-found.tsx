/** What visitors see for a page that isn't published (or doesn't exist). No HolmOS branding. */
export function PublicNotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-white px-4 text-center">
      <div>
        <p className="text-5xl font-bold text-slate-200">404</p>
        <h1 className="mt-3 text-lg font-semibold text-slate-900">This page isn&apos;t available</h1>
        <p className="mt-1 text-sm text-slate-500">Siden findes ikke, eller den er ikke offentlig længere.</p>
      </div>
    </main>
  );
}

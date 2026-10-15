import { ButtonLink, Card } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="px-4 py-16">
      <Card className="mx-auto max-w-lg p-6">
        <h1 className="text-lg font-semibold text-slate-900">Page not found</h1>
        <p className="mt-2 text-sm text-slate-600">That page doesn&apos;t exist, or the client was deleted.</p>
        <ButtonLink href="/" className="mt-5">
          Back to the pipeline
        </ButtonLink>
      </Card>
    </main>
  );
}

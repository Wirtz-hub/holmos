"use client";

import { Trash2 } from "lucide-react";
import { useTransition } from "react";
import { Button } from "@/components/ui";
import { deleteClientAction } from "@/lib/actions/clients";

export function DeleteClientButton({ clientId, name }: { clientId: string; name: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="danger"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(`Delete ${name}? This can't be undone.`)) return;
        startTransition(() => deleteClientAction(clientId));
      }}
    >
      <Trash2 className="size-4" aria-hidden />
      {pending ? "Deleting…" : "Delete"}
    </Button>
  );
}

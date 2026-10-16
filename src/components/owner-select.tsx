"use client";

import { inputClass } from "@/components/ui";

export type ClientOption = { id: string; name: string };

/**
 * Who a page or form belongs to: you (leads go to your pipeline) or one of
 * your clients (leads go to that client's contact list).
 */
export function OwnerSelect({
  clients,
  id = "client_id",
  name = "client_id",
  value,
  defaultValue,
  onChange,
}: {
  clients: ClientOption[];
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (clientId: string) => void;
}) {
  return (
    <select
      id={id}
      name={name}
      value={value}
      defaultValue={value === undefined ? (defaultValue ?? "") : undefined}
      onChange={(e) => onChange?.(e.target.value)}
      className={inputClass}
    >
      <option value="">HolmNordic (you): leads go to your pipeline</option>
      {clients.length > 0 && (
        <optgroup label="A client: leads go to their contact list">
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  );
}

export const OWNER_HINT = "Who it's for. A client's page or form puts people on that client's own contact list, not in your pipeline.";

import type { ListingInput } from '../types/canonical.js';

/** Fields tracked for change detection → triggers a snapshot insertion */
export interface TrackedFields {
  price: number;
  status: string;
  km: number | null;
  locationText: string | null;
}

export interface DiffResult {
  /** True if at least one tracked field changed */
  changed: boolean;
  /** Per-column delta { from, to } for changed fields */
  changedFields: Record<string, { from: unknown; to: unknown }>;
}

/**
 * Compute a diff between the current DB state and the incoming listing.
 * Returns changed=false when all tracked fields are identical.
 */
export function computeDiff(current: TrackedFields, incoming: ListingInput): DiffResult {
  const changedFields: Record<string, { from: unknown; to: unknown }> = {};

  if (current.price !== incoming.price) {
    changedFields.price = { from: current.price, to: incoming.price };
  }

  if (current.status !== incoming.status) {
    changedFields.status = { from: current.status, to: incoming.status };
  }

  if (current.km !== incoming.km) {
    changedFields.km = { from: current.km, to: incoming.km };
  }

  if (current.locationText !== incoming.locationText) {
    changedFields.location_text = {
      from: current.locationText,
      to: incoming.locationText,
    };
  }

  return {
    changed: Object.keys(changedFields).length > 0,
    changedFields,
  };
}

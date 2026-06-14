/** Walk-in shop sales — no CRM record; online/pre-order sales link customers. */

export const WALK_IN_CUSTOMER_LABEL = "Walk-in";

export type OrderStoreType = "Online" | "Walk-in";

export function normalizeStoreType(raw: string): OrderStoreType {
  return raw === "Walk-in" ? "Walk-in" : "Online";
}

export function isWalkInStoreType(storeType: string | null | undefined) {
  return storeType === "Walk-in";
}

/** Human-readable label for orders board, receipts, and daily sales. */
export function displayOrderCustomerName(
  customerName: string,
  storeType?: string | null,
) {
  const trimmed = customerName.trim();
  if (
    isWalkInStoreType(storeType) &&
    (!trimmed || trimmed === WALK_IN_CUSTOMER_LABEL)
  ) {
    return "Walk-in (shop)";
  }
  return trimmed || "—";
}

export type PreparedOrderCustomer =
  | {
      ok: true;
      customerName: string;
      contact: string | null;
      location: string | null;
      linkCustomerRecord: boolean;
      customerIdHint?: number;
    }
  | { ok: false; error: string };

export function prepareOrderCustomer(params: {
  storeType: OrderStoreType;
  customerName: string;
  contact?: string;
  location?: string;
  customerIdRaw?: number;
}): PreparedOrderCustomer {
  if (params.storeType === "Walk-in") {
    return {
      ok: true,
      customerName: WALK_IN_CUSTOMER_LABEL,
      contact: null,
      location: null,
      linkCustomerRecord: false,
    };
  }

  const name = params.customerName.trim();
  if (!name) {
    return {
      ok: false,
      error: "Customer name is required for online orders.",
    };
  }

  return {
    ok: true,
    customerName: name,
    contact: params.contact?.trim() || null,
    location: params.location?.trim() || null,
    linkCustomerRecord: true,
    customerIdHint:
      params.customerIdRaw && params.customerIdRaw > 0
        ? params.customerIdRaw
        : undefined,
  };
}

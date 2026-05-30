export type TransportPricing = {
  baseFeeCents: number;
  perKmCents: number;
  minimumFeeCents: number;
};

export function calculateTransportFee(
  pricing: TransportPricing,
  distanceKm: number,
  extrasTotalCents = 0,
) {
  const distanceFeeCents = Math.round(distanceKm * pricing.perKmCents);
  const subtotal = pricing.baseFeeCents + distanceFeeCents;
  const basePlusDistance = Math.max(subtotal, pricing.minimumFeeCents);
  return {
    distanceKm,
    baseFeeCents: pricing.baseFeeCents,
    distanceFeeCents,
    extrasTotalCents,
    totalFeeCents: basePlusDistance + extrasTotalCents,
  };
}

export function kmToTenths(km: number) {
  return Math.round(km * 10);
}

export function tenthsToKm(tenths: number) {
  return tenths / 10;
}

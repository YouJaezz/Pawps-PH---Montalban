export type TransportPricing = {
  baseFeeCents: number;
  perKmCents: number;
  minimumFeeCents: number;
  trafficPerMinCents: number;
  stopLightFeeCents: number;
};

export type TravelFeeInput = {
  trafficBufferMinutes?: number;
  intersectionCount?: number;
};

export function calculateTravelFees(
  pricing: Pick<TransportPricing, "trafficPerMinCents" | "stopLightFeeCents">,
  input: TravelFeeInput,
) {
  const trafficBufferMinutes = Math.max(0, input.trafficBufferMinutes ?? 0);
  const intersectionCount = Math.max(0, input.intersectionCount ?? 0);
  const trafficFeeCents = trafficBufferMinutes * pricing.trafficPerMinCents;
  const stopLightFeeCents = intersectionCount * pricing.stopLightFeeCents;
  return { trafficFeeCents, stopLightFeeCents, trafficBufferMinutes, intersectionCount };
}

export function calculateTransportFee(
  pricing: TransportPricing,
  distanceKm: number,
  extrasTotalCents = 0,
  travel?: TravelFeeInput,
) {
  const distanceFeeCents = Math.round(distanceKm * pricing.perKmCents);
  const { trafficFeeCents, stopLightFeeCents } = calculateTravelFees(pricing, travel ?? {});
  const subtotal =
    pricing.baseFeeCents +
    distanceFeeCents +
    trafficFeeCents +
    stopLightFeeCents;
  const basePlusDistance = Math.max(subtotal, pricing.minimumFeeCents);
  return {
    distanceKm,
    baseFeeCents: pricing.baseFeeCents,
    distanceFeeCents,
    trafficFeeCents,
    stopLightFeeCents,
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

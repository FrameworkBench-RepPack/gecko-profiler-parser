import type { Thread } from "../schemas/threadSchemas.ts";
import { isNetworkPayload } from "../schemas/markerSchemas.ts";
import Decimal from "decimal.js";

export type SerializedBandwidth = string;

export type BandwidthMeasurement = [string, Decimal];
export type SerializedBandwidthMeasurement = [string, SerializedBandwidth];

export type BenchmarkBandwidth = {
  total: Decimal;
  measurements: BandwidthMeasurement[];
};

export type SerializedBenchmarkBandwidth = {
  total: SerializedBandwidth;
  measurements: SerializedBandwidthMeasurement[];
};

export function processBandwidth(
  markers: Thread["markers"]["data"],
): BenchmarkBandwidth {
  let total = new Decimal(0);
  const measurements: BandwidthMeasurement[] = [];

  for (const marker of markers) {
    const payload = marker[5];
    if (!isNetworkPayload(payload) || payload.count === undefined) continue;
    measurements.push([payload.URI, new Decimal(payload.count)]);
    total = total.add(payload.count);
  }

  return {
    total,
    measurements,
  };
}

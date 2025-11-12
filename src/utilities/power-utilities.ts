import {
  PowerAmountUnit,
  PowerAmount,
  type BenchmarkPowerConsumption,
  PowerAmountTimeSeries,
} from "../power-amount.ts";
import { type Counter } from "../schemas/profilerSchema.ts";

export function processPowerConsumption(
  counter: Counter
): BenchmarkPowerConsumption {
  if (counter.category !== "power")
    throw new Error("Counter does not contain power samples");

  const timeIndex = counter.samples.schema["time"];
  const powerIndex = counter.samples.schema["count"];

  if (timeIndex === undefined || powerIndex === undefined)
    throw new Error("Counter does not contain power samples");

  const powerConsumption: BenchmarkPowerConsumption = {
    total: new PowerAmount(0, PowerAmountUnit.PicoWattHour),
    measurements: new PowerAmountTimeSeries(PowerAmountUnit.PicoWattHour),
  };

  for (const sample of counter.samples.data) {
    const time = sample[timeIndex];
    const power = sample[powerIndex];

    if (!time || !power) throw new Error("Time or power not defined");

    powerConsumption.total.amount += power;
    powerConsumption.measurements.series.push({
      time,
      power,
    });
  }

  return powerConsumption;
}

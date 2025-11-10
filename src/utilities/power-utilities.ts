import {
  PowerAmountUnit,
  PowerAmount,
  BenchmarkPowerConsumption,
} from "../power-amount";
import { Counter } from "../schemas/profilerSchema";

export function processPowerConsumption(
  counter: Counter
): BenchmarkPowerConsumption {
  if (counter.category !== "power")
    throw new Error("Counter does not contain power samples");

  console.log(counter.samples.schema);

  const timeIndex = counter.samples.schema["time"];
  const powerIndex = counter.samples.schema["count"];

  if (timeIndex === undefined || powerIndex === undefined)
    throw new Error("Counter does not contain power samples");

  const powerConsumption: BenchmarkPowerConsumption = {
    total: new PowerAmount(0, PowerAmountUnit.PicoWattHour),
    measurements: [],
  };

  for (const sample of counter.samples.data) {
    const time = sample[timeIndex];
    const power = sample[powerIndex];

    if (!time || !power) throw new Error("Time or power not defined");

    powerConsumption.total.amount += power;
    powerConsumption.measurements.push({
      time,
      amount: new PowerAmount(power, PowerAmountUnit.PicoWattHour),
    });
  }

  return powerConsumption;
}

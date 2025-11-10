export enum PowerAmountUnit {
  PicoWattHour = "pWh",
  MicroWattHour = "μWh",
  MilliWattHour = "mWh",
  WattHour = "Wh",
}

export class PowerAmount {
  amount: number;
  unit: PowerAmountUnit;

  #conversionToWh: Record<PowerAmountUnit, number> = {
    [PowerAmountUnit.PicoWattHour]: 1e-12, // 1 pWh = 1e-12 Wh
    [PowerAmountUnit.MicroWattHour]: 1e-6, // 1 mWh = 1e-6 Wh
    [PowerAmountUnit.MilliWattHour]: 1e-3, // 1 mWh = 1e-3 Wh
    [PowerAmountUnit.WattHour]: 1, // 1 Wh = 1 Wh
  };

  constructor(amount: number, unit: PowerAmountUnit) {
    this.amount = amount;
    this.unit = unit;
  }

  // TODO: Efficiency can be improved
  convert(newUnit: PowerAmountUnit) {
    if (this.unit === newUnit) return;

    const amountInWh = this.amount * this.#conversionToWh[this.unit];

    this.unit = newUnit;
    this.amount = amountInWh / this.#conversionToWh[newUnit];
  }

  toString(): string {
    return `${this.amount} ${this.unit}`;
  }
}

export type BenchmarkPowerConsumption = {
  total: PowerAmount;
  measurements: { time: number; amount: PowerAmount }[];
};

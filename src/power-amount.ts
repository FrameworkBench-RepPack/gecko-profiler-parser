export const PowerAmountUnit = {
  PicoWattHour: "pWh",
  MicroWattHour: "μWh",
  MilliWattHour: "mWh",
  WattHour: "Wh",
} as const;

export type PowerAmountUnit =
  (typeof PowerAmountUnit)[keyof typeof PowerAmountUnit];

const _conversionToWh: Record<PowerAmountUnit, number> = {
  [PowerAmountUnit.PicoWattHour]: 1e-12, // 1 pWh = 1e-12 Wh
  [PowerAmountUnit.MicroWattHour]: 1e-6, // 1 mWh = 1e-6 Wh
  [PowerAmountUnit.MilliWattHour]: 1e-3, // 1 mWh = 1e-3 Wh
  [PowerAmountUnit.WattHour]: 1, // 1 Wh = 1 Wh
} as const;

export class PowerAmount {
  amount: number;
  unit: PowerAmountUnit;

  constructor(amount: number, unit: PowerAmountUnit) {
    this.amount = amount;
    this.unit = unit;
  }

  // TODO: Efficiency can be improved
  convert(newUnit: PowerAmountUnit) {
    if (this.unit === newUnit) return;

    const amountInWh = this.amount * _conversionToWh[this.unit];

    this.unit = newUnit;
    this.amount = amountInWh / _conversionToWh[newUnit];
  }

  getString(decimals?: number): string {
    return `${decimals ? this.amount.toFixed(decimals) : this.amount} ${
      this.unit
    }`;
  }
}

export class PowerAmountTimeSeries {
  series: { time: number; power: number }[];
  unit: PowerAmountUnit;

  constructor(
    unit: PowerAmountUnit,
    series?: { time: number; power: number }[]
  ) {
    this.series = series ? series : [];
    this.unit = unit;
  }

  #convertEntry(amount: number, newUnit: PowerAmountUnit): number {
    const amountInWh = amount * _conversionToWh[this.unit];
    return amountInWh / _conversionToWh[newUnit];
  }

  convert(newUnit: PowerAmountUnit) {
    if (this.unit === newUnit) return;

    for (const entry of this.series) {
      entry.power = this.#convertEntry(entry.power, newUnit);
    }

    this.unit = newUnit;
  }
}

export type BenchmarkPowerConsumption = {
  total: PowerAmount;
  measurements: PowerAmountTimeSeries;
};

import Decimal from "decimal.js";
export const PowerAmountUnit = {
  PicoWattHour: "pWh",
  MicroWattHour: "μWh",
  MilliWattHour: "mWh",
  WattHour: "Wh",
  Joule: "J",
} as const;

export type PowerAmountUnit =
  (typeof PowerAmountUnit)[keyof typeof PowerAmountUnit];

const _conversionToWh: Record<PowerAmountUnit, Decimal> = {
  [PowerAmountUnit.PicoWattHour]: new Decimal(1e-12), // 1 pWh = 1e-12 Wh
  [PowerAmountUnit.MicroWattHour]: new Decimal(1e-6), // 1 mWh = 1e-6 Wh
  [PowerAmountUnit.MilliWattHour]: new Decimal(1e-3), // 1 mWh = 1e-3 Wh
  [PowerAmountUnit.WattHour]: new Decimal(1), // 1 Wh = 1 Wh
  [PowerAmountUnit.Joule]: new Decimal(1).dividedBy(3600), // 1 J = 1 / 3600 Wh
} as const;

function _convertPower(
  newUnit: PowerAmountUnit,
  currUnit: PowerAmountUnit,
  currAmount: Decimal,
) {
  const amountInWh = currAmount.times(_conversionToWh[currUnit]);
  return amountInWh.dividedBy(_conversionToWh[newUnit]);
}

export type SerializedPowerAmount = {
  amount: string;
  unit: PowerAmountUnit;
};

export class PowerAmount {
  #amount: Decimal;
  #unit: PowerAmountUnit;

  constructor(amount: Decimal, unit: PowerAmountUnit) {
    this.#amount = amount;
    this.#unit = unit;
  }

  /**
   * Function to convert the power amount to another unit
   * @param newUnit The new power unit
   */
  convert(newUnit: PowerAmountUnit) {
    if (this.#unit === newUnit) return;

    this.#amount = _convertPower(newUnit, this.#unit, this.#amount);
    this.#unit = newUnit;
  }

  /**
   * Function to get the power amount
   * @param newUnit An optional unit for the returned power
   * @returns The amount of power
   */
  getAmount(newUnit: PowerAmountUnit = PowerAmountUnit.PicoWattHour) {
    if (newUnit !== this.#unit)
      return _convertPower(newUnit, this.#unit, this.#amount);
    return this.#amount;
  }

  /**
   * Function to set the power amount
   * @param amount An optional unit for the returned power
   * @returns The amount of power
   */
  addAmount(amount: PowerAmount) {
    this.#amount = this.#amount.add(amount.getAmount(this.#unit));
  }

  setAmount(amount: Decimal) {
    this.#amount = amount;
  }

  /**
   * Getter for the power unit
   * @returns The power unit
   */
  getUnit() {
    return this.#unit;
  }

  /**
   * Utility function to get a preformatted string
   * @param decimals Number of decimals to show for the power amount
   * @returns A string representation of the power amount
   */
  getString(decimals?: number): string {
    return `${decimals ? this.#amount.toFixed(decimals) : this.#amount} ${
      this.#unit
    }`;
  }

  /**
   * Function to facilitate passing these objects between worker and main thread
   * @returns An object representing the PowerAmount object
   */
  toJSON(): SerializedPowerAmount {
    return {
      amount: this.#amount.toString(),
      unit: this.#unit,
    };
  }

  static fromJSON(
    input: SerializedPowerAmount | undefined,
  ): PowerAmount | undefined {
    if (input === undefined) return undefined;
    return new PowerAmount(new Decimal(input.amount), input.unit);
  }
}

export type SerializedPowerAmountSeries = {
  series: { time: string; power: string }[];
  unit: PowerAmountUnit;
};

export class PowerAmountSeries {
  #series: { time: Decimal; power: Decimal }[];
  #unit: PowerAmountUnit;

  constructor(
    unit: PowerAmountUnit,
    series?: { time: Decimal; power: Decimal }[],
  ) {
    this.#series = series ? series : [];
    this.#unit = unit;
  }

  /**
   * Function to convert the power amounts to another unit
   * @param newUnit The new power unit
   */
  convert(newUnit: PowerAmountUnit) {
    if (this.#unit === newUnit) return;

    for (const entry of this.#series) {
      entry.power = _convertPower(newUnit, this.#unit, entry.power);
    }

    this.#unit = newUnit;
  }

  /**
   * Function to get the measurement series
   * @param newUnit An optional unit for the returned power
   * @returns The amount of power
   */
  getMeasurements(newUnit: PowerAmountUnit = PowerAmountUnit.PicoWattHour) {
    if (newUnit !== this.#unit)
      return this.#series.map((entry) => {
        return {
          time: entry.time,
          power: _convertPower(newUnit, this.#unit, entry.power),
        };
      });
    return this.#series;
  }

  /**
   * Getter for the power unit
   * @returns The power unit
   */
  getUnit() {
    return this.#unit;
  }

  /**
   * Function to facilitate passing these objects between worker and main thread
   * @returns An object representing the PowerAmountTimeSeries object
   */
  toJSON(): SerializedPowerAmountSeries {
    return {
      series: this.#series.map(({ time, power }) => {
        return { time: time.toString(), power: power.toString() };
      }),
      unit: this.#unit,
    };
  }

  static fromJSON(
    input: SerializedPowerAmountSeries | undefined,
  ): PowerAmountSeries | undefined {
    if (input === undefined) return undefined;
    return new PowerAmountSeries(
      input.unit,
      input.series.map(({ time, power }) => {
        return { time: new Decimal(time), power: new Decimal(power) };
      }),
    );
  }
}

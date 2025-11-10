import { InputFile } from "../utilities/file-helpers.ts";
import { PowerAmount, BenchmarkPowerConsumption } from "../power-amount.ts";

type ProcessedFile = InputFile & {
  powerConsumption: BenchmarkPowerConsumption;
};

export type WorkerInputData = {
  benchmark: string;
  framework: string;
  files: InputFile[];
};
export type WorkerOutputData = {
  benchmark: string;
  framework: string;
  average: PowerAmount;
  standardDeviation: number;
  files: ProcessedFile[];
};

export const MessageType = {
  Finished: 0,
  Error: 1,
} as const;
export type MessageType = (typeof MessageType)[keyof typeof MessageType];

type PayloadMap = {
  [MessageType.Finished]: WorkerOutputData;
  [MessageType.Error]: { error: string };
};

export type WorkerMessage<Type extends MessageType> = {
  type: Type;
  payload: PayloadMap[Type];
};

export type MessageStructures = {
  [K in MessageType]: [WorkerMessage<K>, null];
};

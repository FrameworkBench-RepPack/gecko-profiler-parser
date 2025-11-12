import { parentPort, workerData, type MessagePort } from "worker_threads";
import {
  MessageType,
  type WorkerMessage,
  type MessageStructures,
} from "./worker-types.ts";
import { type InputFile, loadFile } from "../utilities/file-helpers.ts";
import { profilerSchema } from "../schemas/profilerSchema.ts";
import { processPowerConsumption } from "../utilities/power-utilities.ts";
import {
  type BenchmarkPowerConsumption,
  PowerAmount,
  PowerAmountUnit,
} from "../power-amount.ts";

function onWorkerMessage<T extends MessageType>(
  type: T,
  handler: (message: WorkerMessage<T>) => void
) {
  parentPort?.on("message", (message) => {
    if (message.type === type) handler(message as WorkerMessage<T>);
  });
}

function getAveragePowerConsumption(inputs: PowerAmount[]): PowerAmount {
  const consumption = inputs.reduce<PowerAmount>((acc, curr) => {
    curr.convert(PowerAmountUnit.PicoWattHour);
    acc.amount += curr.amount;
    return acc;
  }, new PowerAmount(0, PowerAmountUnit.PicoWattHour));

  consumption.amount = consumption.amount / inputs.length;
  return consumption;
}

function getMeanPowerConsumption(inputs: PowerAmount[]): PowerAmount {
  const mean =
    inputs.reduce((acc, curr) => {
      acc += curr.amount;
      return acc;
    }, 0) / inputs.length;

  const sumPart = inputs.reduce((acc, curr) => {
    acc += (curr.amount - mean) ** 2;
    return acc;
  }, 0);

  return new PowerAmount(
    Math.sqrt(sumPart / inputs.length),
    PowerAmountUnit.PicoWattHour
  );
}

function postMessage<T extends MessageType>(message: MessageStructures[T][0]) {
  parentPort?.postMessage(message);
}

async function processFile(file: InputFile): Promise<{
  name: string;
  path: string;
  powerConsumption: BenchmarkPowerConsumption;
}> {
  const loadedFile = await loadFile(file);
  const parsedFile = await profilerSchema.safeParseAsync(
    JSON.parse(loadedFile.content)
  );

  if (!parsedFile.success)
    throw new Error(
      `Failed to parse file: "${file.path}" with error: ${parsedFile.error}`
    );

  // Identify the process of the utilized tap
  const localhostProcess = parsedFile.data.processes.find((process) => {
    for (const page of process.pages) {
      if (page.url.includes("http://localhost:")) return true;
    }

    return false;
  });

  if (!localhostProcess)
    throw new Error(
      "Profiling does not contain a process for a page hosted locally"
    );

  const powerCounter = localhostProcess.counters.find(
    (counter) => counter.category === "power"
  );

  if (!powerCounter)
    throw new Error(
      "Profiling does not contain power counters for the localhost process"
    );

  const powerConsumption = processPowerConsumption(powerCounter);
  powerConsumption.measurements.series = [];

  return {
    powerConsumption: powerConsumption,
    ...file,
  };
}

(async () => {
  if (!parentPort) throw new Error("Message channel 'parentPort' not defined");

  onWorkerMessage(MessageType.Start, async ({ payload }) => {
    const fileProcessingPromises = payload.files.map(async (file) => {
      return processFile(file);
    });

    const processedFiles = await Promise.all(fileProcessingPromises);

    postMessage({
      type: MessageType.Finished,
      payload: {
        benchmark: payload.benchmark,
        framework: payload.framework,
        average: getAveragePowerConsumption(
          processedFiles.map((file) => file.powerConsumption.total)
        ),
        standardDeviation: getMeanPowerConsumption(
          processedFiles.map((file) => file.powerConsumption.total)
        ),
        // files: processedFiles,
      },
    });
  });

  await new Promise<void>((res, rej) => {
    onWorkerMessage(MessageType.Terminate, () => {
      res();
    });
  });
})()
  .catch((err) => {
    parentPort?.postMessage({
      type: MessageType.Error,
      payload: { error: err.message },
    });
  })
  .finally(() => process.exit(0));

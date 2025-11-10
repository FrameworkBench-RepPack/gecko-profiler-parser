import { parentPort, workerData } from "worker_threads";
import {
  MessageType,
  type WorkerInputData,
  type MessageStructures,
} from "./worker-types.ts";
import { loadFile } from "../utilities/file-helpers.ts";
import { profilerSchema } from "../schemas/profilerSchema.ts";
import { processPowerConsumption } from "../utilities/power-utilities.ts";
import { PowerAmount, PowerAmountUnit } from "../power-amount.ts";

function getAveragePowerConsumption(inputs: PowerAmount[]): PowerAmount {
  const consumption = inputs.reduce<PowerAmount>((acc, curr) => {
    curr.convert(PowerAmountUnit.PicoWattHour);
    acc.amount += curr.amount;
    return acc;
  }, new PowerAmount(0, PowerAmountUnit.PicoWattHour));

  consumption.amount = consumption.amount / inputs.length;
  return consumption;
}

function postMessage<T extends MessageType>(message: MessageStructures[T][0]) {
  parentPort?.postMessage(message);
}

(async () => {
  const input: WorkerInputData = workerData;

  const fileProcessingPromises = input.files.map(async (file) => {
    const loadedFile = await loadFile(file);
    const parsedFile = await profilerSchema.safeParseAsync(loadedFile);

    if (!parsedFile.success)
      throw new Error("Failed to parse file with error: " + parsedFile.error);

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

    return {
      powerConsumption: powerConsumption,
      ...file,
    };
  });

  const processedFiles = await Promise.all(fileProcessingPromises);

  postMessage({
    type: MessageType.Finished,
    payload: {
      benchmark: input.benchmark,
      framework: input.framework,
      average: getAveragePowerConsumption(
        processedFiles.map((file) => file.powerConsumption.total)
      ),
      standardDeviation: 0,
      files: processedFiles,
    },
  });
})().finally(process.exit(0));

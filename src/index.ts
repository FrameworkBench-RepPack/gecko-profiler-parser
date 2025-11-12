import { program } from "commander";
import { Worker } from "node:worker_threads";
import path from "node:path";
import { getBenchmarkFiles, groupFiles } from "./utilities/file-helpers";
import {
  MessageType,
  WorkerInputData,
  WorkerMessage,
  WorkerOutputData,
} from "./worker/worker-types";
import { PowerAmount, PowerAmountUnit } from "./power-amount";

const PROCESSING_WORKER_PATH = path.resolve(
  import.meta.dirname,
  "./worker/worker.ts"
);

export function onWorkerMessage<T extends MessageType>(
  worker: Worker,
  type: T,
  handler: (message: WorkerMessage<T>) => void
) {
  worker.on("message", (message) => {
    if (message.type === type) handler(message as WorkerMessage<T>);
  });
}

(async () => {
  program
    .name("Firefox Profiler Parser")
    .description(
      "A CLI tool for processing power measurements from the Firefox Profiler"
    )
    .version("1.0.0")
    .argument(
      "<path>",
      "Path to a profiler .json file or a folder containing multiple profiler .json files"
    )
    .option("-t, --threads <entries>", "specify number of workers to use", "1");

  // Parse program and extract options
  program.parse();
  const options = program.opts();

  const path = program.args[0];
  if (!path || typeof path !== "string")
    throw new Error("Passed path is not a string");

  const threads = Number.parseInt(options.threads);

  // Get and organize relevant files
  const files = await getBenchmarkFiles(path);
  const groupedFiles = groupFiles(files);

  // Prepare variables
  const tasks: WorkerInputData[] = [];
  const processedData: WorkerOutputData[] = [];

  // Create worker tasks
  for (const [benchmark, benchmarkObject] of Object.entries(groupedFiles)) {
    console.log(`Benchmark: ${benchmark}`);
    for (const [framework, files] of Object.entries(benchmarkObject)) {
      console.log(
        `Creating Worker Task - Framework: ${framework}, Iterations: ${files.length}`
      );

      const workerData: WorkerInputData = { benchmark, framework, files };
      tasks.push(workerData);
    }
  }

  const startWorker = (task: WorkerInputData) => {
    return new Promise<void>((res, rej) => {
      const worker = new Worker(PROCESSING_WORKER_PATH);

      worker.postMessage({ type: MessageType.Start, payload: task });

      onWorkerMessage(worker, MessageType.Error, (error) => {
        console.error("Worker threw and error: ", error);
        rej(error);
      });

      onWorkerMessage(worker, MessageType.Finished, (message) => {
        processedData.push(message.payload);

        console.log(
          `Worker finished task for: ${message.payload.benchmark} - ${message.payload.framework}`
        );

        const nextTask = tasks.pop();
        if (!nextTask) {
          worker.postMessage({ type: MessageType.Terminate });
          res();
          return;
        }

        worker.postMessage({ type: MessageType.Start, payload: nextTask });
      });
    });
  };

  // Schedule threads
  console.log(`Starting ${threads} workers`);

  const workers: Promise<void>[] = [];
  for (let i = 0; i < threads; i++) {
    const task = tasks.pop();
    if (!task) break;
    workers.push(startWorker(task));
  }
  await Promise.all(workers);

  for (const result of processedData) {
    const average: PowerAmount = new PowerAmount(
      result.average.amount,
      result.average.unit
    );
    average.convert(PowerAmountUnit.MicroWattHour);

    const standardDeviation: PowerAmount = new PowerAmount(
      result.standardDeviation.amount,
      result.standardDeviation.unit
    );
    standardDeviation.convert(PowerAmountUnit.MicroWattHour);
    console.log(
      `${result.benchmark} - ${result.framework} - Average: ${average.getString(
        2
      )} Standard deviation: ${standardDeviation.getString(2)}`
    );
  }
})();

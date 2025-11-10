import { program } from "commander";
import { Worker } from "node:worker_threads";
import path from "node:path";
import { getBenchmarkFiles, groupFiles } from "./utilities/file-helpers.ts";
import {
  MessageType,
  WorkerInputData,
  WorkerMessage,
  WorkerOutputData,
} from "./worker/worker-types.ts";

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
    );

  // Parse program and extract options
  program.parse();
  const options = program.opts();

  const path = program.args[0];
  if (!path || typeof path !== "string")
    throw new Error("Passed path is not a string");

  const files = await getBenchmarkFiles(path);
  const groupedFiles = groupFiles(files);

  const workerPromises: Promise<WorkerOutputData>[] = [];

  for (const [benchmark, benchmarkObject] of Object.entries(groupedFiles)) {
    console.log(`Benchmark: ${benchmark}`);
    for (const [framework, files] of Object.entries(benchmarkObject)) {
      console.log(
        `Spawning Worker - Framework: ${framework}, Iterations: ${files.length}`
      );

      const workerData: WorkerInputData = { benchmark, framework, files };

      const worker = new Worker(PROCESSING_WORKER_PATH, {
        workerData,
      });

      workerPromises.push(
        new Promise<WorkerOutputData>((resolve, _) => {
          onWorkerMessage(worker, MessageType.Finished, (message) => {
            console.log(
              `${message.payload.benchmark} - ${
                message.payload.framework
              } - Finished processing with average: ${message.payload.average.toString()}`
            );
            resolve(message.payload);
          });
        })
      );
    }
  }

  const results = await Promise.all(workerPromises);
})();

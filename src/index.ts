import { program } from "commander";
import path from "node:path";
import { mkdirSync, write } from "node:fs";
import {
  getAbsolutePath,
  getBenchmarkFiles,
  getResultsPaths,
  groupFiles,
} from "./utilities/file-helpers";
import {
  ProcessedFile,
  WorkerInputData,
  WorkerOutputData,
} from "./worker/worker-types";
import {
  PowerAmount,
  PowerAmountSeries,
  PowerAmountUnit,
} from "./power-amount";
import { startWorker } from "./worker/start-worker";
import { writeCSV } from "./utilities/csv-utilities";
import Decimal from "decimal.js";

const PROCESSING_WORKER_PATH = path.resolve(
  import.meta.dirname,
  "./worker/worker.ts",
);

(async () => {
  program
    .name("Firefox Profiler Parser")
    .description(
      "A CLI tool for processing power measurements from the Firefox Profiler",
    )
    .version("1.0.0")
    .argument(
      "<path>",
      "Path to a profiler .json file or a folder containing multiple profiler .json files",
    )
    .option("-t, --threads <entries>", "specify number of workers to use", "1")
    .option("--exportRaw", "export power measurements in csv file", false);

  // Parse program and extract options
  program.parse();
  const options = program.opts();

  const inputPath = program.args[0];
  if (!inputPath || typeof inputPath !== "string")
    throw new Error("Passed path is not a string");

  const threads = Number.parseInt(options.threads);

  // Get and organize relevant files
  const files = await getBenchmarkFiles(inputPath);
  const groupedFiles = groupFiles(files);

  // Prepare variables
  const tasks: WorkerInputData[] = [];
  const processedData: WorkerOutputData[] = [];

  // Create worker tasks
  for (const [benchmark, benchmarkObject] of Object.entries(groupedFiles)) {
    console.log(`Benchmark: ${benchmark}`);
    for (const [framework, files] of Object.entries(benchmarkObject)) {
      console.log(
        `Creating Worker Task - Framework: ${framework}, Iterations: ${files.length}`,
      );

      const workerData: WorkerInputData = { benchmark, framework, files };
      tasks.push(workerData);
    }
  }

  // Schedule threads
  console.log(`Starting ${threads} workers`);

  const workers: Promise<void>[] = [];
  for (let i = 0; i < threads; i++) {
    const task = tasks.pop();
    if (!task) break;
    workers.push(
      startWorker({
        initialTask: task,
        taskQueue: tasks,
        processedData,
        workerPath: PROCESSING_WORKER_PATH,
      }),
    );
  }
  await Promise.all(workers);

  const [resultsPath, summedResultsPath, combinedResultsPath, rawResultsPath] =
    await getResultsPaths({
      inputPath,
      resultsFolderName: "processed-results",
      summedResultsFolderName: "summed-results",
      combinedResultsFolderName: "combined-results",
      rawResultsFolderName: options.exportRaw ? "raw-results" : undefined,
    });

  // Deserialize results
  const deserializedResults = processedData.map((r) => {
    return {
      ...r,
      powerAverage: PowerAmount.fromJSON(r.powerAverage),
      powerStandardDeviation: PowerAmount.fromJSON(r.powerStandardDeviation),
      bandwidthAverage: r.bandwidthAverage
        ? new Decimal(r.bandwidthAverage)
        : undefined,
      bandwidthStandardDeviation: r.bandwidthStandardDeviation
        ? new Decimal(r.bandwidthStandardDeviation)
        : undefined,
      files: r.files.map((f) => {
        return {
          ...f,
          powerConsumption: {
            total: PowerAmount.fromJSON(f.powerConsumption?.total),
            measurements: PowerAmountSeries.fromJSON(
              f.powerConsumption?.measurements,
            ),
          },
          bandwidth: f.bandwidth
            ? {
                total: new Decimal(f.bandwidth?.total),
                measurements: f.bandwidth.measurements.map<[string, Decimal]>(
                  ([file, bandwidth]) => [file, new Decimal(bandwidth)],
                ),
              }
            : undefined,
        };
      }),
    };
  });

  /* Export per benchmark CSV processed results*/
  const perBenchmarkCsvEntries = deserializedResults.reduce<
    Record<string, string[][]>
  >((acc, result) => {
    if (!acc[result.benchmark]) acc[result.benchmark] = [];

    acc[result.benchmark]?.push([
      result.framework,
      result.powerAverage?.getAmount(PowerAmountUnit.Joule).toString() ?? "N/A",
      result.powerStandardDeviation
        ?.getAmount(PowerAmountUnit.Joule)
        .toString() ?? "N/A",
      result.bandwidthAverage?.toString() ?? "N/A",
      result.bandwidthStandardDeviation?.toString() ?? "N/A",
    ]);

    return acc;
  }, {});

  for (const [benchmark, result] of Object.entries(perBenchmarkCsvEntries)) {
    writeCSV({
      path: resultsPath + `/${benchmark}.csv`,
      header: [
        "Framework",
        `Average Total Power (${PowerAmountUnit.Joule})`,
        `Total Power SD (${PowerAmountUnit.Joule})`,
        `Average Total Bandwidth (B)`,
        `Total Bandwidth SD (B)`,
      ],
      fields: result,
    });
  }

  /* Export per benchmark CSV processed results*/
  const combinedPerBenchmarkIterations = deserializedResults.reduce<
    Record<string, string[][]>
  >((acc, result) => {
    if (!acc[result.benchmark]) acc[result.benchmark] = [];

    for (const file of result.files) {
      acc[result.benchmark]?.push([
        result.framework,
        file.powerConsumption.total
          ?.getAmount(PowerAmountUnit.Joule)
          .toString() ?? "N/A",
        file.bandwidth?.total?.toString() ?? "N/A",
      ]);
    }

    return acc;
  }, {});

  for (const [benchmark, result] of Object.entries(
    combinedPerBenchmarkIterations,
  )) {
    writeCSV({
      path: combinedResultsPath + `/${benchmark}.csv`,
      header: [
        "Framework",
        `Total Power (${PowerAmountUnit.Joule})`,
        `Total Bandwidth (B)`,
      ],
      fields: result,
    });
  }

  for (const result of deserializedResults) {
    result.powerAverage?.convert(PowerAmountUnit.MicroWattHour);
    result.powerStandardDeviation?.convert(PowerAmountUnit.MicroWattHour);

    console.log(
      `${result.benchmark} - ${result.framework} - Power average: ${
        result.powerAverage ? result.powerAverage.getString(2) : "N/A"
      } Standard deviation: ${
        result.powerStandardDeviation
          ? result.powerStandardDeviation.getString(2)
          : "N/A"
      } - Bandwidth: ${
        result.bandwidthAverage
          ? `${result.bandwidthAverage.div(1000)} KB`
          : "N/A"
      } Standard deviation: ${result.bandwidthStandardDeviation ?? "N/A"}`,
    );

    // Extract total power measurements
    writeCSV({
      path: summedResultsPath + `/${result.benchmark}-${result.framework}.csv`,
      header: [
        "Iteration",
        `Total Power (${PowerAmountUnit.Joule})`,
        "Total Bandwidth (B)",
      ],
      fields: result.files.map((processedFile, index) => [
        index,
        processedFile.powerConsumption?.total
          ?.getAmount(PowerAmountUnit.Joule)
          .toString() ?? "N/A",
        processedFile.bandwidth?.total.toString() ?? "N/A",
      ]),
    });

    if (options.exportRaw) {
      for (const file of result.files) {
        const fileName = file.name.split(".")[0];
        if (!fileName) throw new Error("Splitting file failed");

        const powerAmountSeries = file.powerConsumption?.measurements;

        writeCSV({
          path: rawResultsPath + `/${file.name}_power-raw.csv`,
          header: [
            "Time",
            `Total Power (${powerAmountSeries?.getUnit() ?? "N/A"})`,
          ],
          fields:
            powerAmountSeries
              ?.getMeasurements()
              .map((measurement) => [
                measurement.time.toString(),
                measurement.power.toString(),
              ]) ?? [],
        });

        writeCSV({
          path: rawResultsPath + `/${file.name}_bandwidth-raw.csv`,
          header: ["File", "Total Bandwidth (B)"],
          fields:
            file.bandwidth?.measurements.map(([file, size]) => [
              file,
              size.toString(),
            ]) ?? [],
        });
      }
    }
  }
})();

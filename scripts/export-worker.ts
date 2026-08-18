import { processNextExportJob } from "../lib/export-jobs";
import { prisma } from "../lib/prisma";

const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function run() {
  console.log(JSON.stringify({ level: "info", event: "export_worker_started" }));
  while (true) {
    const processed = await processNextExportJob();
    if (!processed) await delay(3000);
  }
}

run().catch((error) => { console.error(JSON.stringify({ level: "error", event: "export_worker_stopped", message: error instanceof Error ? error.message : String(error) })); process.exitCode = 1; }).finally(() => prisma.$disconnect());

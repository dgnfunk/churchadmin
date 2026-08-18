import { processNextCommunicationDelivery } from "../lib/communications-worker";
import { prisma } from "../lib/prisma";

const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function run() {
  console.log(JSON.stringify({ level: "info", event: "communications_worker_started" }));
  while (true) {
    const processed = await processNextCommunicationDelivery();
    if (!processed) await delay(3000);
  }
}

run().catch((error) => {
  console.error(JSON.stringify({ level: "error", event: "communications_worker_stopped", message: error instanceof Error ? error.message : String(error) }));
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());

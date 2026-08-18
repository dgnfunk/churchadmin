import { PrismaClient } from "@prisma/client";
import { unlink } from "node:fs/promises";
import path from "node:path";

const prisma = new PrismaClient();
const exportRoot = path.resolve(process.env.EXPORT_STORAGE_PATH ?? path.join(process.cwd(), ".tmp", "exports"));
const expired = await prisma.exportJob.findMany({ where: { expiresAt: { lt: new Date() }, fileName: { not: null } } });
for (const job of expired) {
  const filePath = path.resolve(exportRoot, job.fileName);
  if (filePath.startsWith(`${exportRoot}${path.sep}`)) await unlink(filePath).catch(() => null);
}
await prisma.exportJob.deleteMany({ where: { id: { in: expired.map((job) => job.id) } } });
await prisma.$disconnect();
console.log(`Removed ${expired.length} expired export(s).`);

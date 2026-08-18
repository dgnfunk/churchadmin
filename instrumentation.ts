declare global {
  var churchAdminCleanupTimer: NodeJS.Timeout | undefined;
  var churchAdminExportTimer: NodeJS.Timeout | undefined;
  var churchAdminCommunicationsTimer: NodeJS.Timeout | undefined;
}

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || globalThis.churchAdminCleanupTimer) return;
  const [{ cleanupExpiredExports }, { cleanupExpiredAttendeeSessions }] = await Promise.all([import("@/lib/export-jobs"), import("@/lib/attendee-auth")]);
  void Promise.all([cleanupExpiredExports(), cleanupExpiredAttendeeSessions()]).catch((error) => console.error("Cleanup failed.", error));
  globalThis.churchAdminCleanupTimer = setInterval(() => {
    void Promise.all([cleanupExpiredExports(), cleanupExpiredAttendeeSessions()]).catch((error) => console.error("Cleanup failed.", error));
  }, 24 * 60 * 60 * 1000);
  globalThis.churchAdminCleanupTimer.unref();
  if (process.env.EXPORT_WORKER_IN_APP !== "false" && !globalThis.churchAdminExportTimer) {
    const { processNextExportJob } = await import("@/lib/export-jobs");
    globalThis.churchAdminExportTimer = setInterval(() => { void processNextExportJob(); }, 3000);
    globalThis.churchAdminExportTimer.unref();
  }
  if (process.env.COMMUNICATIONS_WORKER_IN_APP !== "false" && !globalThis.churchAdminCommunicationsTimer) {
    const { processNextCommunicationDelivery } = await import("@/lib/communications-worker");
    globalThis.churchAdminCommunicationsTimer = setInterval(() => { void processNextCommunicationDelivery(); }, 3000);
    globalThis.churchAdminCommunicationsTimer.unref();
  }
}

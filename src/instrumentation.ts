/** Next calls this once per server process, before the first request. */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startPollers } = await import("@/lib/runtime/poller");
  await startPollers();
}

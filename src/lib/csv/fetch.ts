import { logger } from "@/lib/runtime/logger";

export class CsvFetchError extends Error {
  constructor(
    message: string,
    readonly url: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "CsvFetchError";
  }
}

const TIMEOUT_MS = 20_000;
const RETRY_DELAY_MS = 2_000;

async function once(url: string, timeoutMs: number): Promise<ArrayBuffer> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { "user-agent": "sado-tracker-2026 (+https://sado-tracker-2026.teraren.com)" },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new CsvFetchError(`Result export returned HTTP ${response.status}`, url);
  }
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength === 0) {
    throw new CsvFetchError("Result export returned an empty body", url);
  }
  return buffer;
}

/** Fetch the result export, retrying once before giving up. */
export async function fetchCsv(url: string, timeoutMs = TIMEOUT_MS): Promise<ArrayBuffer> {
  try {
    return await once(url, timeoutMs);
  } catch (error) {
    logger.warn("Result export fetch failed, retrying", { url, error: String(error) });
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    try {
      return await once(url, timeoutMs);
    } catch (retryError) {
      throw new CsvFetchError("Result export fetch failed twice", url, retryError);
    }
  }
}

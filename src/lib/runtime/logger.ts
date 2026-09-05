type Fields = Record<string, unknown>;

const seen = new Set<string>();

function emit(level: "info" | "warn" | "error", message: string, fields?: Fields): void {
  const line = JSON.stringify({ level, message, at: new Date().toISOString(), ...fields });
  process.stderr.write(`${line}\n`);
}

export const logger = {
  info: (message: string, fields?: Fields) => emit("info", message, fields),
  warn: (message: string, fields?: Fields) => emit("warn", message, fields),
  error: (message: string, fields?: Fields) => emit("error", message, fields),
};

/** Log a message at most once per key, for noisy per-row parse warnings. */
export function logOnce(key: string, message: string, fields?: Fields): void {
  if (seen.has(key)) return;
  seen.add(key);
  emit("warn", message, fields);
}

/** Test helper: forget which keys have been logged. */
export function resetLogOnce(): void {
  seen.clear();
}

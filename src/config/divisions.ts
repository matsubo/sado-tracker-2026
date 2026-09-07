import type { Division } from "./types";

/** The four scored divisions, in the order every tab bar and table lists them. */
export const DIVISIONS = ["A", "B", "RA", "RB"] as const satisfies readonly Division[];

export const DIVISION_LABELS: Readonly<Record<Division, string>> = {
  A: "Aタイプ",
  B: "Bタイプ",
  RA: "RAタイプ（リレー）",
  RB: "RBタイプ（リレー）",
};

export function isDivision(value: string): value is Division {
  return (DIVISIONS as readonly string[]).includes(value);
}

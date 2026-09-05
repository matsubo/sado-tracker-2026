export type Sex = "M" | "F";

export interface AgeGroup {
  /** Short id shown in tables: sex letter plus the bracket lower bound, e.g. "M40", "F0". */
  readonly id: string;
  readonly sex: Sex;
  readonly min: number;
  readonly max: number;
  /** Japanese label for headings and selects, e.g. "女子45-49". */
  readonly label: string;
}

const SEX_BY_KANJI: Record<string, Sex> = { 男子: "M", 女子: "F", 男: "M", 女: "F" };

/** "40-44男子", "40-44歳男子" and "M40-44" all describe the same bracket. */
const JP_RANGE = /^(\d{1,2})\s*-\s*(\d{1,2})歳?(男子|女子|男|女)$/;
const JP_YOUNGEST = /^(\d{1,2})歳以下(男子|女子|男|女)$/;
const ASCII_RANGE = /^([MF])(\d{1,2})-(\d{1,2})$/;

function build(sex: Sex, min: number, max: number): AgeGroup {
  const jp = sex === "M" ? "男子" : "女子";
  const label = min === 0 ? `${jp}${max}歳以下` : `${jp}${min}-${max}`;
  return { id: `${sex}${min}`, sex, min, max, label };
}

/**
 * Turn a raw 年齢区分 label into a canonical age group. Returns null for
 * relay entries and other rows that carry no bracket.
 */
export function normalizeAgeGroup(raw: string): AgeGroup | null {
  const text = raw.normalize("NFKC").trim();
  if (text === "") return null;

  const range = JP_RANGE.exec(text);
  if (range) {
    const sex = SEX_BY_KANJI[range[3] as string];
    if (!sex) return null;
    return build(sex, Number(range[1]), Number(range[2]));
  }

  const youngest = JP_YOUNGEST.exec(text);
  if (youngest) {
    const sex = SEX_BY_KANJI[youngest[2] as string];
    if (!sex) return null;
    return build(sex, 0, Number(youngest[1]));
  }

  const ascii = ASCII_RANGE.exec(text);
  if (ascii) {
    return build(ascii[1] as Sex, Number(ascii[2]), Number(ascii[3]));
  }

  return null;
}

/** Sort age groups the way the source lists them: men then women, youngest first. */
export function compareAgeGroups(a: AgeGroup, b: AgeGroup): number {
  if (a.sex !== b.sex) return a.sex === "M" ? -1 : 1;
  return a.min - b.min;
}

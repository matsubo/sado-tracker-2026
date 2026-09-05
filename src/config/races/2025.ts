import type { RaceConfig } from "../types";
import { longCourse, middleCourse } from "./courses";

/**
 * The 2025 B swim was shortened to 1.35 km on the day. The distance is used
 * for displayed pace, but the leg is excluded from prediction features
 * because a shortened course is a different swim, not a scaled one.
 */
export const race2025: RaceConfig = {
  year: 2025,
  csvUrl: "https://systemway.jp/25sado?dlcsv=t",
  raceDate: "2025-09-07",
  divisions: {
    A: longCourse({ swimKm: 4.0 }),
    RA: longCourse({ swimKm: 4.0 }),
    B: middleCourse({ swimKm: 1.35, swimTimesComparable: false }),
    RB: middleCourse({ swimKm: 1.35, swimTimesComparable: false }),
  },
  divisionAliases: {
    Aタイプ: "A",
    RAタイプ: "RA",
    Bタイプ: "B",
    RBタイプ: "RB",
    予備: null,
  },
  nameHeaders: ["名前", "氏名"],
  totalHeaders: ["総合記録"],
  usableForPrediction: true,
};

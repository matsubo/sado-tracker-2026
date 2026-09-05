import type { RaceConfig } from "../types";
import { longCourse, middleCourse } from "./courses";

/**
 * 2023 used full-width division labels and a single Ｒタイプ relay class.
 *
 * Two classes have to be read from their finish times rather than their
 * names, because filing either under the long course divides middle-distance
 * times by long-course distances and yields impossible paces:
 *
 * - チャンピオンシップ is the middle-distance elite race. Its finishers
 *   median 5.4 hours against 14.2 for Aタイプ, and the published course is
 *   2 / 108 / 21.1 km. Filed under A it produced 71 km/h on the bike.
 * - Ｒタイプ, the year's only relay class, medians 7.5 hours, matching the
 *   later RBタイプ at 7.2 rather than RAタイプ at 12.4.
 */
export const race2023: RaceConfig = {
  year: 2023,
  csvUrl: "https://systemway.jp/23sado?dlcsv=t",
  raceDate: "2023-09-03",
  divisions: {
    A: longCourse({ swimKm: 4.0 }),
    RA: longCourse({ swimKm: 4.0 }),
    B: middleCourse({ swimKm: 2.0 }),
    RB: middleCourse({ swimKm: 2.0 }),
  },
  divisionAliases: {
    Ａタイプ: "A",
    Ｂタイプ: "B",
    Ｒタイプ: "RB",
    チャンピオンシップ: "B",
    予備: null,
  },
  nameHeaders: ["氏名", "名前"],
  totalHeaders: ["総合記録"],
  usableForPrediction: true,
};

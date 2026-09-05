import type { RaceConfig } from "../types";
import { longCourse, middleCourse } from "./courses";

/** 2023 used full-width division labels and a single Ｒタイプ relay class. */
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
    Ｒタイプ: "RA",
    チャンピオンシップ: "A",
    予備: null,
  },
  nameHeaders: ["氏名", "名前"],
  totalHeaders: ["総合記録"],
  usableForPrediction: true,
};

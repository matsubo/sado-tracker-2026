import type { RaceConfig } from "../types";
import { longCourse, middleCourse } from "./courses";

export const race2026: RaceConfig = {
  year: 2026,
  csvUrl: "https://systemway.jp/26sado?dlcsv=t",
  raceDate: "2026-09-06",
  divisions: {
    A: longCourse({ swimKm: 4.0 }),
    RA: longCourse({ swimKm: 4.0 }),
    B: middleCourse({ swimKm: 2.0 }),
    RB: middleCourse({ swimKm: 2.0 }),
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

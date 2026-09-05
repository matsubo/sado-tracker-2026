import type { RaceConfig } from "../types";
import { longCourse, middleCourse } from "./courses";

export const race2026: RaceConfig = {
  year: 2026,
  csvUrl: "https://systemway.jp/26sado?dlcsv=t",
  raceDate: "2026-09-06",
  // Wind and tide on the day cut the swim in half and pushed both waves back:
  // A and RA swim two 1,000 m laps from 06:30, B and RB one lap from 08:00.
  // Past swim times are therefore over a different distance and cannot be
  // compared with this year's, so the swim is scored within 2026 alone.
  divisions: {
    A: longCourse({ swimKm: 2.0, waveStart: "06:30", swimTimesComparable: false }),
    RA: longCourse({ swimKm: 2.0, waveStart: "06:30", swimTimesComparable: false }),
    B: middleCourse({ swimKm: 1.0, waveStart: "08:00", swimTimesComparable: false }),
    RB: middleCourse({ swimKm: 1.0, waveStart: "08:00", swimTimesComparable: false }),
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

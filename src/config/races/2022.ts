import type { RaceConfig } from "../types";
import { longCourse, middleCourse } from "./courses";

/**
 * 2022 used ASCII division labels and a different set of timing points
 * (水津AID on the bike, run splits every 3-4 km at 沢根 and 本部). Only
 * whole-discipline times are comparable, so it is excluded from prediction
 * training and used for past-result lookup only.
 */
export const race2022: RaceConfig = {
  year: 2022,
  csvUrl: "https://systemway.jp/22sado?dlcsv=t",
  raceDate: "2022-09-04",
  divisions: {
    A: longCourse({ swimKm: 4.0 }),
    RA: longCourse({ swimKm: 4.0 }),
    B: middleCourse({ swimKm: 2.0 }),
    RB: middleCourse({ swimKm: 2.0 }),
  },
  divisionAliases: {
    ATYPE: "A",
    "ATYPE ELITE": "A",
    CHAMPIONSHIP: "A",
    BTYPE: "B",
    RTYPE: "RA",
    予備: null,
  },
  nameHeaders: ["氏名", "名前"],
  totalHeaders: [],
  usableForPrediction: false,
};

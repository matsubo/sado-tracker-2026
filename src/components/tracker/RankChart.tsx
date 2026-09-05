"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { RankSetDto } from "@/lib/api/contract";

/** Loaded in the browser only: echarts touches `window` at import time. */
const ReactECharts = dynamic(() => import("echarts-for-react"), {
  ssr: false,
  loading: () => <Skeleton className="h-[200px] w-full" />,
});

/** One measured point of the athlete's rank history. */
export interface RankHistoryEntry {
  readonly checkpointId: string;
  readonly label: string;
  readonly ranks: RankSetDto;
}

interface ChartTheme {
  readonly series: readonly [string, string, string];
  readonly text: string;
  readonly line: string;
}

/** Reads the design tokens so the chart follows the light and dark palettes. */
function readTheme(): ChartTheme | null {
  if (typeof window === "undefined") return null;
  const style = window.getComputedStyle(document.documentElement);
  const value = (name: string): string => style.getPropertyValue(name).trim();
  const one = value("--chart-1");
  if (one === "") return null;
  return {
    series: [one, value("--chart-2"), value("--chart-3")],
    text: value("--muted-foreground"),
    line: value("--border"),
  };
}

/** Re-reads the tokens whenever the theme class on `<html>` changes. */
function useChartTheme(): ChartTheme | null {
  const [theme, setTheme] = useState<ChartTheme | null>(null);

  useEffect(() => {
    const sync = (): void => setTheme(readTheme());
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return theme;
}

interface RankChartProps {
  readonly history: readonly RankHistoryEntry[];
  readonly sexLabel: string;
  readonly ageGroupLabel: string | null;
}

/** Rank at every timing point so far, with first place at the top. */
export function RankChart({ history, sexLabel, ageGroupLabel }: RankChartProps): React.JSX.Element {
  const theme = useChartTheme();
  if (theme === null || history.length === 0) {
    return <Skeleton className="h-[200px] w-full" />;
  }

  const pick = (key: keyof RankSetDto): (number | null)[] =>
    history.map((entry) => entry.ranks[key]?.rank ?? null);

  const series = [
    { name: "部門総合", data: pick("division"), color: theme.series[0] },
    { name: sexLabel, data: pick("sex"), color: theme.series[1] },
    {
      name: ageGroupLabel === null ? "エイジ" : `エイジ ${ageGroupLabel}`,
      data: pick("ageGroup"),
      color: theme.series[2],
    },
  ];

  const option = {
    animation: false,
    grid: { left: 44, right: 12, top: 28, bottom: 46 },
    tooltip: { trigger: "axis" as const },
    legend: {
      bottom: 0,
      itemWidth: 12,
      itemHeight: 3,
      textStyle: { color: theme.text, fontSize: 11 },
    },
    xAxis: {
      type: "category" as const,
      data: history.map((entry) => entry.label),
      axisLabel: { color: theme.text, fontSize: 9, interval: "auto" as const, rotate: 30 },
      axisLine: { lineStyle: { color: theme.line } },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value" as const,
      inverse: true,
      min: 1,
      name: "順位",
      nameTextStyle: { color: theme.text, fontSize: 9 },
      axisLabel: { color: theme.text, fontSize: 9 },
      splitLine: { lineStyle: { color: theme.line } },
    },
    series: series.map((entry) => ({
      name: entry.name,
      type: "line" as const,
      data: entry.data,
      connectNulls: false,
      symbolSize: 5,
      lineStyle: { width: 2.2, color: entry.color },
      itemStyle: { color: entry.color },
    })),
  };

  return <ReactECharts option={option} style={{ height: 200, width: "100%" }} notMerge />;
}

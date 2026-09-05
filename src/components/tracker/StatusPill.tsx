import { Badge } from "@/components/ui/badge";
import type { AthleteSummaryDto } from "@/lib/api/contract";

const RACING_LABELS: Record<string, string> = {
  swim: "スイム中",
  bike: "バイク中",
  run: "ラン中",
};

/** The athlete's state, coloured by the discipline they are on. */
export function StatusPill({ athlete }: { athlete: AthleteSummaryDto }) {
  if (athlete.status === "finished") return <Badge variant="secondary">フィニッシュ</Badge>;
  if (athlete.status === "dnf") return <Badge variant="destructive">リタイア</Badge>;
  if (athlete.status === "not_started") return <Badge variant="outline">スタート前</Badge>;
  if (athlete.status === "dns_suspected") return <Badge variant="outline">未計測</Badge>;

  const discipline = athlete.position.discipline;
  return (
    <Badge variant={discipline}>
      {athlete.position.inTransition ? "トランジション" : (RACING_LABELS[discipline] ?? "レース中")}
    </Badge>
  );
}

import { Badge } from "@/components/ui/badge";
import { DISCIPLINE_LABELS } from "@/config/races";
import type { AthleteSummaryDto } from "@/lib/api/contract";

/** The athlete's state, coloured by the discipline they are on. */
export function StatusPill({ athlete }: { athlete: AthleteSummaryDto }) {
  if (athlete.status === "finished") return <Badge variant="secondary">フィニッシュ</Badge>;
  if (athlete.status === "dnf") return <Badge variant="destructive">DNF</Badge>;
  if (athlete.status === "not_started") return <Badge variant="outline">スタート前</Badge>;
  if (athlete.status === "dns_suspected") return <Badge variant="outline">DNS</Badge>;

  const discipline = athlete.position.discipline;
  return (
    <Badge variant={discipline}>
      {athlete.position.inTransition ? "トランジション" : `${DISCIPLINE_LABELS[discipline]}中`}
    </Badge>
  );
}

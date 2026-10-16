import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import type { Decision } from "../api/schemas";
import { DECISION_LABELS, formatDateTime } from "../reviewCases";

const ROWS_SHOWN = 3;

function DecisionItem({ decision }: Readonly<{ decision: Decision }>) {
	const rest = decision.rows.length - ROWS_SHOWN;
	return (
		<Card className="space-y-2 p-4 text-sm">
			<div className="flex flex-wrap items-center gap-2">
				<Badge variant="soft">{DECISION_LABELS[decision.kind]}</Badge>
				<span className="text-muted-foreground">
					{formatDateTime(decision.madeAt)} · зміна №{decision.changeNo}
				</span>
			</div>
			<p>
				{decision.staffUser?.name ?? "Без суперкористувача"}, ключ{" "}
				{decision.keyName}
				{decision.reversesId ? `, скасовує ${decision.reversesId}` : ""}
			</p>
			{decision.rows.length === 0 ? (
				<p className="text-muted-foreground">
					Рядки не змінено: залишено безпечну відповідь.
				</p>
			) : (
				<div className="space-y-1">
					<p className="text-muted-foreground">
						Змінено рядків: {decision.rows.length}
					</p>
					<ul className="space-y-0.5 font-mono text-xs">
						{decision.rows.slice(0, ROWS_SHOWN).map((row) => (
							<li key={`${row.list}:${row.id}`} className="break-words">
								{row.list}/{row.id}: {row.change}
							</li>
						))}
					</ul>
					{rest > 0 ? (
						<p className="text-muted-foreground">і ще {rest}</p>
					) : null}
				</div>
			)}
		</Card>
	);
}

export function DecisionTrail({
	decisions,
}: Readonly<{ decisions: ReadonlyArray<Decision> }>) {
	if (decisions.length === 0) {
		return <p className="text-sm text-muted-foreground">Рішень ще немає.</p>;
	}
	return (
		<ul className="space-y-3" aria-label="Журнал рішень">
			{decisions.map((decision) => (
				<li key={decision.id}>
					<DecisionItem decision={decision} />
				</li>
			))}
		</ul>
	);
}

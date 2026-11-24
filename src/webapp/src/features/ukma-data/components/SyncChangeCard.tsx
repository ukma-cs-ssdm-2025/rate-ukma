import type { SyncChange } from "@/lib/api/generated";
import { kindLabel, stateLabel } from "../sync";
import { countWith, RATINGS } from "../syncFormat";

export function SyncChangeCard({
	change,
	showState = false,
}: Readonly<{ change: SyncChange; showState?: boolean }>) {
	const { view } = change;
	const where = [view.place, view.semester].filter(
		(part): part is string => part !== null && part.length > 0,
	);
	const facts = [
		kindLabel(change.kind),
		showState ? stateLabel(change.state) : null,
		change.ratings > 0 ? countWith(change.ratings, RATINGS) : null,
	].filter((part): part is string => part !== null);
	return (
		<div className="space-y-1 rounded-xl border bg-card px-4 py-3 text-sm">
			<p className="font-medium break-words">{view.title}</p>
			{where.length > 0 ? (
				<p className="text-muted-foreground">{where.join(", ")}</p>
			) : null}
			{view.rows.length > 0 ? (
				<ul className="space-y-0.5">
					{view.rows.map((row) => (
						<li key={`${row.field}-${row.after}`} className="break-words">
							<span className="text-muted-foreground">{row.label}: </span>
							{row.before === "" ? null : (
								<>
									<del className="text-muted-foreground">{row.before}</del>
									{" → "}
								</>
							)}
							{row.after === "" ? "порожньо" : row.after}
						</li>
					))}
				</ul>
			) : null}
			<p className="text-muted-foreground">{facts.join(", ")}</p>
		</div>
	);
}

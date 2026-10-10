import type { LessonChange } from "@/features/schedule/core";
import { groupOf } from "@/features/schedule/core";
import { displayShort } from "@/features/schedule/lib/names";
import {
	pillOf,
	type ChangeGhost,
} from "@/features/schedule/lib/lesson-changes";

/** The outline a changed lesson gets on the grid and on the phone: amber is
 *  «look at this», red stays for clashes. Solid wins over the `outline-none`
 *  a focusable lecture card carries. */
export const CHANGED_STYLE =
	"outline-2 outline-offset-2 outline-solid! outline-warning/60";

/** What changed, under a lesson's meta line. */
export function ChangePill(props: { change: LessonChange; inverse: boolean }) {
	return (
		<span
			data-testid="change-pill"
			data-kind={props.change.kind}
			className={`mt-1 inline-block rounded-full px-1.5 py-px text-mini font-medium text-warning ${props.inverse ? "bg-card" : "bg-warning/14"}`}
		>
			{pillOf(props.change)}
		</span>
	);
}

/** The dashed trace where a lesson stood before it moved or was cancelled. */
export function ChangeGhostCard(props: {
	ghost: ChangeGhost;
	names: ReadonlyMap<string, string>;
	labels: ReadonlyMap<string, string>;
}) {
	const { ghost, names, labels } = props;
	const { row } = ghost;
	const name =
		labels.get(row.disciplineId) ??
		displayShort(names, row.disciplineId, row.discipline);
	return (
		<div
			data-testid="change-ghost"
			className="mb-1.5 rounded-lg border border-dashed border-warning/50 bg-warning/10 px-2.5 py-2 text-meta text-muted-foreground"
		>
			<s className="block text-xs font-medium decoration-muted-foreground/60">
				{name}, {groupOf(row)}
			</s>
			{ghost.note}
		</div>
	);
}

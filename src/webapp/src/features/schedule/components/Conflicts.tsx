import type { DisciplineId, Plan } from "@/features/schedule/core";
import { describeTime } from "@/features/schedule/core";
import { ChevronDown } from "lucide-react";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/Collapsible";
import type {
	Conflict,
	Conflicts as ConflictSet,
} from "@/features/schedule/core";
import {
	DAY_SHORT,
	formatWeeks,
	wordFor,
} from "@/features/schedule/lib/format";
import { displayShort } from "@/features/schedule/lib/names";
interface Props {
	result: Plan;
	conflicts: ConflictSet;
	names: ReadonlyMap<string, string>;
	setFocus: (id: DisciplineId | undefined) => void;
}

const whenOf = (conflict: Conflict): string =>
	`${DAY_SHORT[conflict.day]}, ${describeTime(conflict.time)}, тижні ${formatWeeks(conflict.weeks)}`;

/**
 * One line while the plan collides: how many times, with a red count and a
 * way to the grid. The details — which two lessons, when, in which weeks —
 * unfold on demand. What to do about them is the student's call.
 */
export function Conflicts({ result, conflicts, names, setFocus }: Props) {
	const { lectures, chosen, culprits } = conflicts;
	const count = lectures.length + chosen.length;
	if (result.satisfiable && count === 0) return null;

	const nameOf = (id: DisciplineId, fallback: string) =>
		displayShort(names, id, fallback);
	const sideLabel = (side: Conflict["a"]) =>
		`«${nameOf(side.disciplineId, side.discipline)}»${side.group === undefined ? "" : ` гр. ${side.group}`}`;

	// A reading lists one conflict per (pair, day, time) — that tuple is the
	// stable identity. An index key would attach hover state to the wrong row
	// when a resolved clash drops out of the middle of the list.
	const list = (items: ReadonlyArray<Conflict>, prefix: string) => (
		<ul className="flex flex-col gap-1">
			{items.map((conflict) => (
				<li
					key={`${prefix}-${conflict.a.disciplineId}|${conflict.a.group ?? ""}|${conflict.b.disciplineId}|${conflict.b.group ?? ""}|${conflict.day}|${conflict.time.start}`}
					data-testid={`${prefix}-conflict`}
					className="leading-snug"
					onMouseEnter={() => setFocus(conflict.a.disciplineId)}
					onMouseLeave={() => setFocus(undefined)}
				>
					<span className="text-foreground">
						{sideLabel(conflict.a)} і {sideLabel(conflict.b)}
					</span>
					<span className="block text-muted-foreground">
						{whenOf(conflict)}
					</span>
				</li>
			))}
		</ul>
	);

	return (
		<Collapsible
			className="mb-2 rounded-md border border-destructive/20 bg-destructive/5 text-xs"
			data-testid="conflicts"
		>
			<div className="flex items-center gap-1 py-1 pr-1 pl-2.5">
				<CollapsibleTrigger
					className="group/clash flex min-w-0 flex-1 items-center gap-1.5 py-1 text-left font-medium text-destructive"
					data-testid="conflicts-toggle"
				>
					{count > 0 ? (
						<>
							<span className="rounded-full bg-destructive px-1.5 text-mini leading-4 font-semibold text-white tabular-nums">
								{count}
							</span>
							{wordFor(count, ["накладка", "накладки", "накладок"])}
						</>
					) : (
						"Жоден набір груп не складається"
					)}
					<ChevronDown className="size-3.5 shrink-0 transition-transform group-data-[state=open]/clash:rotate-180" />
				</CollapsibleTrigger>
			</div>
			<CollapsibleContent className="flex flex-col gap-2 px-2.5 pb-2">
				{lectures.length > 0 && (
					<div>
						<p className="text-muted-foreground">
							Лекції накладаються, інша група не допоможе.
						</p>
						{list(lectures, "lecture")}
						<p
							className="mt-1 text-muted-foreground"
							data-testid="lecture-clash-fix"
						>
							Якщо одна з пар насправді в інший час чи її не буде, виправ її:
							«Змінити пару» в меню пари на сітці.
						</p>
					</div>
				)}
				{chosen.length > 0 && (
					<div>
						{lectures.length > 0 && (
							<p className="text-muted-foreground">Твій вибір:</p>
						)}
						{list(chosen, "chosen")}
					</div>
				)}
				{!result.satisfiable && lectures.length === 0 && (
					<p className="text-muted-foreground" data-testid="unsatisfiable">
						Жоден набір груп не складається.
					</p>
				)}
				{culprits.length > 0 && (
					<p className="text-muted-foreground" data-testid="culprits">
						Без{" "}
						{culprits
							.map(
								(id) =>
									`«${nameOf(id, result.disciplines.find((d) => d.disciplineId === id)?.discipline ?? id)}»`,
							)
							.join(culprits.length > 2 ? ", " : " або ")}{" "}
						решта сходиться.
					</p>
				)}
			</CollapsibleContent>
		</Collapsible>
	);
}

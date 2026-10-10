import type {
	Correction,
	CustomLessons,
	LessonRow,
	Offering,
	Overrides,
} from "@/features/schedule/core";
import {
	BELL_SLOTS,
	correctionsOf,
	formatWeeks,
	groupOf,
} from "@/features/schedule/core";
import { ChevronDown, PenLine, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/Collapsible";
import { DAY_SHORT, wordFor } from "@/features/schedule/lib/format";
import { displayShort } from "@/features/schedule/lib/names";
import { undoable } from "@/features/schedule/lib/undo";
import { usePlanDraft } from "@/features/schedule/stores/plan";
import { useUi } from "@/features/schedule/stores/ui";

interface Props {
	/** The plan's sheet disciplines as printed, before any correction. */
	printed: ReadonlyArray<Offering>;
	overrides: Overrides;
	custom: CustomLessons;
	names: ReadonlyMap<string, string>;
}

const pairOf = (day: LessonRow["day"], slot: LessonRow["slot"]) =>
	`${DAY_SHORT[day]} ${BELL_SLOTS.indexOf(slot) + 1} пара`;

/** «Ср 3 пара → Чт 1 пара, ауд. 1-313 → онлайн»: only what changed. */
const changeOf = (correction: Correction): string => {
	const { printed, target, weeks, applies } = correction;
	if (!printed) return "у розкладі цієї пари вже немає";
	const when =
		weeks === undefined
			? ""
			: weeks.length === 1
				? `тиждень ${weeks[0]}: `
				: `тижні ${formatWeeks(weeks)}: `;
	if (!applies) return `${when}не діє, у ці тижні пари вже немає`;
	if (target.weeks?.length === 0) return `${when}пари не буде`;
	const parts: string[] = [];
	if (target.day !== printed.day || target.slot !== printed.slot)
		parts.push(
			`${pairOf(printed.day, printed.slot)} → ${pairOf(target.day, target.slot)}`,
		);
	if (target.room !== undefined && target.room !== (printed.room ?? ""))
		parts.push(
			`ауд. ${printed.room ?? "не вказано"} → ${target.room || "не вказано"}`,
		);
	if (target.weeks !== undefined && weeks === undefined)
		parts.push(
			`тижні ${formatWeeks(printed.weeks)} → ${formatWeeks(target.weeks)}`,
		);
	return `${when}${parts.join(", ") || "як у розкладі"}`;
};

/**
 * Everything the student changed by hand, in one place: lessons moved,
 * re-roomed, cut to some weeks or dropped, plus their own lessons. САЗ and
 * the sheets lag behind teachers, so these edits are normal; listing them
 * keeps a timetable that differs from the sheet honest and one click from
 * undone. Folded by default: the rail stays about the disciplines.
 */
export function Corrections({ printed, overrides, custom, names }: Props) {
	const setOverrides = usePlanDraft((state) => state.setOverrides);
	const setEditing = useUi((state) => state.setEditing);
	const corrections = correctionsOf(printed, overrides);
	const count = corrections.length + custom.length;
	if (count === 0) return null;

	return (
		<Collapsible
			className="rounded-md border border-border text-xs"
			data-testid="corrections"
		>
			<CollapsibleTrigger
				className="group/fix flex w-full items-center gap-1.5 px-2.5 py-2 text-left font-medium text-foreground"
				data-testid="corrections-toggle"
			>
				<PenLine className="size-3.5 shrink-0 text-muted-foreground" />
				<span className="min-w-0 flex-1">
					Змінено вручну: {count} {wordFor(count, ["пара", "пари", "пар"])}
				</span>
				<ChevronDown className="size-3.5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/fix:rotate-180" />
			</CollapsibleTrigger>
			<CollapsibleContent>
				<ul className="flex flex-col gap-1 px-1 pb-1.5">
					{corrections.map((correction) => {
						const { offering, printed: row, current } = correction;
						const name = displayShort(
							names,
							offering.disciplineId,
							offering.discipline,
						);
						const label = row ? `${name}, ${groupOf(row)}` : name;
						return (
							<li
								key={correction.keys.join("+")}
								data-testid="correction"
								className="flex items-start gap-1 rounded-md px-1.5 py-1 hover:bg-background"
							>
								{current ? (
									<Button
										size="compact"
										variant="ghost"
										onClick={() =>
											setEditing({ kind: "sheet", row: current, name })
										}
										className="h-auto min-w-0 flex-1 flex-col items-start gap-0 p-0 text-left font-normal whitespace-normal hover:bg-transparent"
									>
										<span className="text-foreground">{label}</span>
										<span className="text-muted-foreground">
											{changeOf(correction)}
										</span>
									</Button>
								) : (
									<span className="min-w-0 flex-1">
										<span className="block text-foreground">{label}</span>
										<span className="block text-muted-foreground">
											{changeOf(correction)}
										</span>
									</span>
								)}
								<Button
									variant="ghost"
									size="icon-xs"
									aria-label={
										row ? `Як у розкладі: ${label}` : `Прибрати зміну: ${label}`
									}
									title={row ? "Як у розкладі" : "Прибрати зміну"}
									data-testid="correction-undo"
									onClick={() =>
										undoable(
											row ? "Пару повернуто як у розкладі" : "Зміну прибрано",
											() =>
												setOverrides(
													correction.keys.map(
														(key) => [key, undefined] as const,
													),
												),
										)
									}
									className="mt-0.5 shrink-0 text-muted-foreground"
								>
									{row ? <RotateCcw /> : <X />}
								</Button>
							</li>
						);
					})}
					{custom.map((lesson) => (
						<li
							key={lesson.id}
							data-testid="correction-own"
							className="flex items-start gap-1 rounded-md px-1.5 py-1 hover:bg-background"
						>
							<Button
								size="compact"
								variant="ghost"
								onClick={() => setEditing({ kind: "own", lesson })}
								className="h-auto min-w-0 flex-1 flex-col items-start gap-0 p-0 text-left font-normal whitespace-normal hover:bg-transparent"
							>
								<span className="text-foreground">{lesson.name}</span>
								<span className="text-muted-foreground">
									своя пара, {pairOf(lesson.day, lesson.slot)}, тижні{" "}
									{formatWeeks(lesson.weeks)}
								</span>
							</Button>
						</li>
					))}
				</ul>
			</CollapsibleContent>
		</Collapsible>
	);
}

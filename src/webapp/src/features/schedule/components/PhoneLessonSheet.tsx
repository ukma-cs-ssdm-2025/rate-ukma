import type {
	DisciplineId,
	GroupLabel,
	InpResolution,
	LessonRow,
	Offering,
} from "@/features/schedule/core";
import {
	BELL_SLOTS,
	describeWhen,
	groupOf,
	placeOf,
} from "@/features/schedule/core";
import { Button } from "@/components/ui/Button";
import { SheetHeader, SheetTitle } from "@/components/ui/Sheet";
import {
	eventHint,
	type CalendarEvent,
} from "@/features/schedule/lib/calendar-events";
import type { Semester } from "@/features/schedule/lib/data";
import { DAY_SHORT, formatWeeks } from "@/features/schedule/lib/format";
import { displayShort } from "@/features/schedule/lib/names";
import { provenanceOf } from "@/features/schedule/lib/provenance";
import { SheetBadge } from "@/features/schedule/components/SheetBadge";
import { weekPatternOf } from "@/features/schedule/lib/weeks";
import { usePlanDraft } from "@/features/schedule/stores/plan";
import { useUi } from "@/features/schedule/stores/ui";

interface Props {
	event: CalendarEvent;
	partners: ReadonlyArray<CalendarEvent>;
	names: ReadonlyMap<string, string>;
	semester: Semester;
	singleWeek: boolean;
	offerings: ReadonlyArray<Offering>;
	onChoose: (disciplineId: DisciplineId, group: GroupLabel) => void;
	readOnly: boolean;
	inp: InpResolution | undefined;
	onSwitchStream: (from: DisciplineId, to: DisciplineId) => void;
	/** Open the lesson editor; the sheet closes first. Absent on a shared page. */
	onEdit: ((row: LessonRow, name: string) => void) | undefined;
	/** Close the sheet; solo and hide leave nothing behind to look at. */
	onClose: () => void;
}

/**
 * The bottom sheet behind a phone lesson's info button: structured rows for
 * the lesson itself, the clash/infeasible reason from the desktop tooltip,
 * plus the choose/unchoose/move/solo/hide actions.
 */
export function PhoneLessonSheet(props: Props) {
	const {
		event,
		partners,
		names,
		semester,
		singleWeek,
		offerings,
		onChoose,
		readOnly,
		onEdit,
		onClose,
		inp,
		onSwitchStream,
	} = props;
	const { row, offering, group, status } = event;
	const main = displayShort(names, row.disciplineId, row.discipline);
	const provenance = provenanceOf(offering, semester, inp);
	const pattern = weekPatternOf(row.weeks, semester.weekDates);
	const hint = eventHint(event, {
		offerings,
		semester,
		singleWeek,
		names,
		partners,
		readOnly,
	});
	const { solo, setSolo } = useUi();
	const toggleHidden = usePlanDraft((state) => state.toggleHidden);
	const groupRows =
		group === undefined ? [row] : (offering.groups[group] ?? []);
	const teachers = [
		...new Set(
			groupRows.flatMap((lesson) =>
				lesson.teacher?.trim() ? [lesson.teacher.trim()] : [],
			),
		),
	];
	const place = placeOf(row);
	// The dl below already names group/teacher/place/when: the box keeps
	// only what the dl cannot say — clash/infeasible/full reasons and the
	// forced-group note. Teacher lines and describeRow duplicates are dropped.
	const reason = hint
		.split("\n")
		.filter(
			(line) =>
				line.startsWith("Накладається на") ||
				line.startsWith("Не поєднується з планом") ||
				line.startsWith("Єдина група") ||
				line === "Немає вільних місць.",
		)
		.join("\n");
	// The clock the lesson really runs, with its bell only when it is one.
	const when = `${describeWhen(row)}, ${pattern.label}`;

	return (
		<div className="pt-2">
			<SheetHeader className="p-0 text-left">
				<SheetTitle data-testid="lesson-sheet-title" className="text-base">
					{main}
				</SheetTitle>
				<SheetBadge
					provenance={provenance}
					disciplineId={offering.disciplineId}
					semester={semester}
					onSwitch={
						readOnly
							? undefined
							: (to) => onSwitchStream(offering.disciplineId, to)
					}
					className="self-start"
				/>
			</SheetHeader>
			<dl className="mt-3 flex flex-col gap-1.5 text-sm">
				<div className="flex gap-2">
					<dt className="w-16 shrink-0 text-muted-foreground">Заняття</dt>
					<dd className="text-foreground">{groupOf(row)}</dd>
				</div>
				{teachers.length > 0 && (
					<div className="flex gap-2">
						<dt className="w-16 shrink-0 text-muted-foreground">Викладач</dt>
						<dd className="text-foreground">{teachers.join("; ")}</dd>
					</div>
				)}
				{place !== undefined && (
					<div className="flex gap-2">
						<dt className="w-16 shrink-0 text-muted-foreground">Місце</dt>
						<dd className="text-foreground">{place}</dd>
					</div>
				)}
				<div className="flex gap-2">
					<dt className="w-16 shrink-0 text-muted-foreground">Час</dt>
					<dd className="text-foreground">{when}</dd>
				</div>
				{row.printed && (
					<div className="flex gap-2">
						<dt className="w-16 shrink-0 text-muted-foreground">У файлі</dt>
						<dd className="text-foreground" data-testid="lesson-sheet-printed">
							{DAY_SHORT[row.printed.day]},{" "}
							{BELL_SLOTS.indexOf(row.printed.slot) + 1} пара, тижні{" "}
							{formatWeeks(row.printed.weeks)}
							{row.printed.room ? `, ауд. ${row.printed.room}` : ""}
						</dd>
					</div>
				)}
			</dl>
			{reason !== "" && (
				<p
					data-testid="lesson-sheet-hint"
					className="mt-3 rounded-md bg-muted/60 px-3 py-2 text-xs leading-relaxed whitespace-pre-line text-muted-foreground"
				>
					{reason}
				</p>
			)}
			{group !== undefined && !readOnly && (
				<Button
					size="compact"
					data-testid="lesson-sheet-action"
					className="mt-4 min-h-11 w-full"
					variant={status === "chosen" ? "secondary" : "default"}
					onClick={() => onChoose(offering.disciplineId, group)}
				>
					{status === "chosen" ? "Зняти вибір" : `Обрати гр. ${group}`}
				</Button>
			)}
			{(status === "lecture" || status === "chosen") && onEdit && (
				<Button
					size="compact"
					variant="outline"
					data-testid="lesson-sheet-edit"
					className="mt-2 min-h-11 w-full"
					onClick={() => onEdit(row, main)}
				>
					Змінити пару
				</Button>
			)}
			{!readOnly && (
				<>
					<Button
						size="compact"
						variant="outline"
						data-testid="lesson-sheet-solo"
						className="mt-2 min-h-11 w-full"
						onClick={() => {
							setSolo(
								solo === offering.disciplineId
									? undefined
									: offering.disciplineId,
							);
							onClose();
						}}
					>
						{solo === offering.disciplineId
							? "Показати всі дисципліни"
							: "Лише ця дисципліна"}
					</Button>
					<Button
						size="compact"
						variant="outline"
						data-testid="lesson-sheet-hide"
						className="mt-2 min-h-11 w-full"
						onClick={() => {
							toggleHidden(offering.disciplineId);
							onClose();
						}}
					>
						Сховати дисципліну
					</Button>
				</>
			)}
		</div>
	);
}

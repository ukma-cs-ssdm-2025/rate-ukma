import type {
	CustomLessons,
	DisciplineId,
	DisciplinePlan,
	GroupLabel,
	Offering,
} from "@/features/schedule/core";
import {
	brandIds,
	groupLabels,
	isCustomOffering,
	without,
} from "@/features/schedule/core";
import { EyeOff, FileWarning } from "lucide-react";
import type React from "react";
import { Button } from "@/components/ui/Button";
import { RowMenu } from "@/features/schedule/components/rail/RowMenu";
import { SheetBadge } from "@/features/schedule/components/SheetBadge";
import type { Semester } from "@/features/schedule/lib/data";
import {
	shortSheet,
	type Provenance,
} from "@/features/schedule/lib/provenance";
import { sheetsOf, unplacedOf } from "@/features/schedule/core";
import { wordFor } from "@/features/schedule/lib/format";
import { displayShort } from "@/features/schedule/lib/names";
import { undoable } from "@/features/schedule/lib/undo";
import { usePlanDraft } from "@/features/schedule/stores/plan";
import { useUi } from "@/features/schedule/stores/ui";

interface Props {
	offering: Offering;
	semester: Semester;
	/** The solver's row for this discipline, if the plan knows it. */
	entry: DisciplinePlan | undefined;
	chosen: GroupLabel | undefined;
	names: ReadonlyMap<string, string>;
	/** What САЗ has on record, per discipline. */
	registered: Readonly<Record<DisciplineId, GroupLabel>>;
	locked: boolean;
	/** From the ІНП: САЗ says the student takes it, so it can be hidden but not removed. */
	fromInp: boolean;
	/** Which sheets publish it and why this stream; alternatives to switch to. */
	provenance: Provenance;
	/** Swap this discipline for another published stream of the same ІНП line. */
	onSwitchStream: (to: DisciplineId) => void;
	/** ІНП lines the sheets now publish: an own lesson standing in for one of
	 *  them may have become a duplicate. */
	publishedCourses: ReadonlySet<string>;
}

type Tone = "ok" | "warn" | "muted";

interface SazStatus {
	/** The plan's own fact, set in the foreground colour: «Група 3», «Обери групу». */
	readonly primary: string;
	/** What САЗ has, quieter: «як у САЗ», «у САЗ група 4». */
	readonly secondary?: string;
	readonly tone: Tone;
	readonly hint: string;
}

const TONE = {
	ok: { dot: "bg-success" },
	warn: { dot: "bg-warning" },
	muted: { dot: "bg-muted-foreground/50" },
} satisfies Record<Tone, { dot: string }>;

/**
 * One line under the name, in two weights: the plan's group first, what САЗ
 * has on record after it. Students register themselves, so a difference is
 * a fact to show, never an error to correct.
 */
const sazStatus = (
	chosen: GroupLabel | undefined,
	inSaz: GroupLabel | undefined,
	/** Groups this discipline actually has in the published schedule. */
	available: ReadonlyArray<GroupLabel>,
): SazStatus => {
	const primary = chosen === undefined ? "Група не обрана" : `Група ${chosen}`;
	if (inSaz !== undefined && !available.includes(inSaz)) {
		return {
			primary,
			secondary: `у САЗ ${inSaz}, поза розкладом`,
			tone: "warn",
			hint: `У САЗ ти в групі ${inSaz}, але у файлі розкладу такої групи немає. Можливо, її ще не опублікували.`,
		};
	}
	if (chosen === undefined && inSaz === undefined) {
		return {
			primary: "Обери групу",
			tone: "warn",
			hint: "Натисни групу на сітці.",
		};
	}
	if (chosen === inSaz) {
		return {
			primary,
			secondary: "як у САЗ",
			tone: "ok",
			hint: `У САЗ ти в групі ${chosen}, у плані вона ж.`,
		};
	}
	if (inSaz === undefined) {
		return {
			primary,
			secondary: "ще не в САЗ",
			tone: "warn",
			hint: "У САЗ запису в цю групу ще немає. Записатися можна на my.ukma.edu.ua.",
		};
	}
	return {
		primary,
		secondary: `у САЗ група ${inSaz}`,
		tone: "warn",
		hint:
			chosen === undefined
				? `У САЗ ти в групі ${inSaz}, у плані група ще не обрана.`
				: `У САЗ ти в групі ${inSaz}, у плані обрано ${chosen}. Це нормально, якщо формально ти в одній групі, а ходиш в іншу.`,
	};
};

/** One discipline in the rail: its name, the plan-vs-САЗ status, and the
 *  hover actions. The group itself is picked on the grid, never here. */
export function DisciplineRow(props: Props) {
	const {
		offering,
		semester,
		entry,
		chosen,
		names,
		registered,
		locked,
		fromInp,
		provenance,
		onSwitchStream,
		publishedCourses,
	} = props;
	const labelOfStream = (id: DisciplineId) => {
		const other = semester.offerings.find((o) => o.disciplineId === id);
		const labels = new Map(
			semester.files.map((file) => [file.source, file.label]),
		);
		const sheets = other
			? sheetsOf(other, (source) => labels.get(source) ?? source).map(
					shortSheet,
				)
			: [];
		return sheets.join(", ") || id;
	};
	const streams =
		provenance.alternatives.length > 0
			? [
					{
						id: offering.disciplineId,
						label: labelOfStream(offering.disciplineId),
						current: true,
					},
					...provenance.alternatives.map((id) => ({
						id,
						label: labelOfStream(id),
						current: false,
					})),
				]
			: undefined;
	const {
		updatePicked,
		updateSelection,
		hidden,
		toggleHidden,
		custom,
		removeCustom,
	} = usePlanDraft();
	const setEditing = useUi((state) => state.setEditing);
	const own = isCustomOffering(offering);
	const ownIds = own
		? offering.lectures.flatMap((row) => row.custom ?? [])
		: [];
	const { setFocus, solo, setSolo } = useUi();
	const isHidden = hidden.includes(offering.disciplineId);
	const isSolo = solo === offering.disciplineId;
	const name = displayShort(names, offering.disciplineId, offering.discipline);
	const undecided =
		chosen === undefined && entry !== undefined && entry.candidates.length > 0;
	return (
		<li
			data-testid={`discipline-${offering.disciplineId}`}
			className={`group/row min-h-11 rounded-lg px-1.5 py-1.5 ${
				undecided ? "bg-warning/8" : "hover:bg-background"
			}`}
			onMouseEnter={() => setFocus(offering.disciplineId)}
			onMouseLeave={() => setFocus(undefined)}
		>
			<div className="flex items-start gap-1">
				<Button
					size="compact"
					type="button"
					variant="ghost"
					title={
						isSolo
							? "Показати всі дисципліни"
							: `${name}. Показати лише цю дисципліну`
					}
					aria-pressed={isSolo}
					data-testid={`solo-name-${offering.disciplineId}`}
					onClick={() => setSolo(isSolo ? undefined : offering.disciplineId)}
					className={`line-clamp-2 h-auto min-w-0 flex-1 justify-start whitespace-normal px-0 py-0.5 text-left text-sm leading-snug font-medium hover:bg-transparent hover:text-primary ${isHidden ? "text-muted-foreground" : "text-foreground"} ${isSolo ? "text-primary" : ""}`}
				>
					{name}
				</Button>
				{isHidden && (
					<EyeOff
						className="mt-1 size-3.5 shrink-0 text-muted-foreground/60"
						aria-label="приховано"
						data-testid={`hidden-${offering.disciplineId}`}
					/>
				)}
				{!locked && (
					<RowMenu
						id={offering.disciplineId}
						name={name}
						hidden={isHidden}
						onToggleHidden={() => toggleHidden(offering.disciplineId)}
						solo={{
							active: isSolo,
							toggle: () => setSolo(isSolo ? undefined : offering.disciplineId),
						}}
						onRemove={
							own
								? () =>
										undoable("Свої пари прибрано", () => removeCustom(ownIds))
								: fromInp
									? undefined
									: () =>
											undoable("Дисципліну прибрано з плану", () => {
												updatePicked((prev) =>
													prev.filter((id) => id !== offering.disciplineId),
												);
												updateSelection((prev) =>
													without(prev, offering.disciplineId),
												);
											})
						}
						streams={streams}
						onSwitchStream={(id) => onSwitchStream(brandIds([id])[0]!)}
						onAddLesson={
							own
								? {
										label: "Додати ще пару",
										run: () =>
											setEditing({
												kind: "own",
												name: offering.discipline,
												...courseOf(custom, ownIds),
											}),
									}
								: undefined
						}
					/>
				)}
			</div>
			<DisciplineStatus
				offering={offering}
				semester={semester}
				entry={entry}
				chosen={chosen}
				registered={registered}
				hidden={isHidden}
				nowPublished={custom.some(
					(lesson) =>
						ownIds.includes(lesson.id) &&
						lesson.courseId !== undefined &&
						publishedCourses.has(lesson.courseId),
				)}
				badge={
					<SheetBadge
						provenance={provenance}
						disciplineId={offering.disciplineId}
						semester={semester}
						onSwitch={locked ? undefined : onSwitchStream}
					/>
				}
			/>
		</li>
	);
}

/** The line under the name, in two weights: the plan's group first, what САЗ
 *  has on record after it — plus the unreadable-rows note when the files
 *  hide some of this discipline's lessons. */
function DisciplineStatus(props: {
	offering: Offering;
	semester: Semester;
	entry: DisciplinePlan | undefined;
	chosen: GroupLabel | undefined;
	registered: Readonly<Record<DisciplineId, GroupLabel>>;
	hidden: boolean;
	/** An own discipline whose ІНП line the sheets publish now. */
	nowPublished: boolean;
	/** Which sheet the lessons come from, at the end of the status line. */
	badge: React.ReactNode;
}) {
	const {
		offering,
		semester,
		entry,
		chosen,
		registered,
		hidden,
		nowPublished,
		badge,
	} = props;
	const lectureOnly = entry === undefined || entry.candidates.length === 0;
	const ownCount = isCustomOffering(offering) ? offering.lectures.length : 0;
	const status: SazStatus = hidden
		? {
				primary: "Прихована",
				tone: "muted",
				hint: "Прихована: не на сітці, не в календарі й не впливає на накладки.",
			}
		: ownCount > 0 && nowPublished
			? {
					primary: ownCount === 1 ? "Своя пара" : `Свої пари: ${ownCount}`,
					secondary: "тепер є в розкладі",
					tone: "warn",
					hint: "Факультет опублікував розклад цієї дисципліни. Якщо пари збігаються, свої можна прибрати в меню «⋯».",
				}
			: ownCount > 0
				? {
						primary: ownCount === 1 ? "Своя пара" : `Свої пари: ${ownCount}`,
						tone: "muted",
						hint: "Додано вручну: у файлах розкладу цієї пари немає.",
					}
				: lectureOnly
					? { primary: "Лише лекції", tone: "muted", hint: "" }
					: sazStatus(
							chosen,
							registered[offering.disciplineId],
							groupLabels(offering),
						);
	const unplaced = unplacedOf(offering, semester.review);
	const unplacedFile = semester.files.find(
		(file) => file.source === unplaced[0]?.source,
	);
	// A dated week that has none of this discipline's lessons reads as the
	// discipline having vanished; say where it went instead.
	const week = useUi((state) => state.week);
	const absentThisWeek =
		week !== undefined &&
		![...offering.lectures, ...Object.values(offering.groups).flat()].some(
			(row) => row.weeks.includes(week),
		);
	return (
		<>
			<div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1">
				<div
					className="flex min-w-0 items-center gap-1.5 text-meta leading-tight text-muted-foreground"
					title={status.hint || undefined}
					data-testid={`status-${offering.disciplineId}`}
				>
					<span
						className={`inline-block size-1.5 shrink-0 rounded-full ${TONE[status.tone].dot}`}
					/>
					<span className="min-w-0">
						<span
							className={
								status.tone === "muted"
									? undefined
									: "font-medium text-foreground"
							}
						>
							{status.primary}
						</span>
						{status.secondary && `, ${status.secondary}`}
					</span>
					{absentThisWeek && (
						<span
							className="shrink-0 rounded-sm bg-muted px-1 text-mini text-muted-foreground"
							data-testid={`absent-${offering.disciplineId}`}
							title="У цьому тижні пар немає; вони в інших тижнях семестру"
						>
							не цього тижня
						</span>
					)}
				</div>
				{badge}
			</div>
			{unplaced.length > 0 && (
				<a
					href={unplacedFile?.stored ?? unplacedFile?.url}
					target="_blank"
					rel="noreferrer"
					data-testid={`unplaced-${offering.disciplineId}`}
					title={unplaced
						.map(
							(item) =>
								`${item.day ?? "день не вказано"}, ${item.time}, ${item.group === "" ? "без групи" : item.group}, тижні «${item.weeks}»`,
						)
						.join("\n")}
					className="mt-1 flex items-center gap-1.5 text-meta leading-tight text-warning underline-offset-2 hover:underline"
				>
					<FileWarning className="size-3 shrink-0" />
					<span>
						у файлі {unplaced.length === 1 ? "є ще" : "ще"} {unplaced.length}{" "}
						{wordFor(unplaced.length, ["пара, яку", "пари, які", "пар, які"])}{" "}
						не вдалося прочитати
					</span>
				</a>
			)}
		</>
	);
}

/** The ІНП line the student's own discipline stands in for, if any of its
 *  lessons was added from one. */
const courseOf = (
	custom: CustomLessons,
	ids: ReadonlyArray<string>,
): { courseId?: string } => {
	const courseId = custom.find((lesson) => ids.includes(lesson.id))?.courseId;
	return courseId === undefined ? {} : { courseId };
};

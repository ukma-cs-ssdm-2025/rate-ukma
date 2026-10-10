import type {
	BellSlot,
	CustomLesson,
	CustomLessons,
	Day,
	LessonRow,
	Override,
	Week,
} from "@/features/schedule/core";
import {
	BELL_SLOTS,
	DAYS,
	formatWeeks,
	groupOf,
	legacyKey,
	lessonKey,
	occurrenceKey,
	overrideOf,
	sameWeeks,
} from "@/features/schedule/core";
import type React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/Select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/ToggleGroup";
import type { Semester } from "@/features/schedule/lib/data";
import { SEGMENT, SEGMENTED } from "@/features/schedule/components/Toolbar";
import { DAY_SHORT, formatSpan } from "@/features/schedule/lib/format";
import { undoable } from "@/features/schedule/lib/undo";
import { usePlanDraft } from "@/features/schedule/stores/plan";
import { useUi, type LessonEdit } from "@/features/schedule/stores/ui";

/** What the editor opens on for a lesson on the grid: the student's own
 *  lesson edits itself, a sheet lesson gets a correction. */
export const editOf = (
	row: LessonRow,
	name: string,
	custom: CustomLessons,
): LessonEdit => {
	const own =
		row.custom === undefined
			? undefined
			: custom.find((l) => l.id === row.custom);
	return own ? { kind: "own", lesson: own } : { kind: "sheet", row, name };
};

/** The weeks a lesson can run in: the dated weeks, or, for a semester whose
 *  files print no week table, every week its lessons mention. */
const teachingWeeks = (semester: Semester): ReadonlyArray<Week> => {
	const dated = [...semester.weekDates.keys()].sort((a, b) => a - b);
	if (dated.length > 0) return dated;
	const last = Math.max(14, ...semester.rows.flatMap((row) => row.weeks));
	// SAFETY: 1..last stays within the 1..20 the parser emits.
	return Array.from({ length: last }, (_, index) => (index + 1) as Week);
};

/** The longest own-lesson name the plan accepts (`CustomLesson`). */
const NAME_MAX = 300;

/** A correction or an own lesson while its optional fields are still being set. */
type OverrideDraft = { -readonly [K in keyof Override]: Override[K] };
type LessonDraft = { -readonly [K in keyof CustomLesson]: CustomLesson[K] };

/**
 * One dialog for every hand edit of the timetable, because САЗ and the
 * sheets are often behind what teachers actually do: correct a sheet lesson
 * (another day, pair, room, weeks, or not held at all), or add a lesson no
 * sheet prints. Either way the grid, the clashes, the share link and every
 * calendar follow it.
 */
export function LessonEditor({ semester }: { semester: Semester }) {
	const editing = useUi((state) => state.editing);
	const setEditing = useUi((state) => state.setEditing);
	const week = useUi((state) => state.week);
	const close = () => setEditing(undefined);
	return (
		<Dialog
			open={editing !== undefined}
			onOpenChange={(open) => open || close()}
		>
			<DialogContent
				className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-md"
				data-testid="lesson-editor"
				phone="top"
				// A phone keyboard over half the form is worse than one tap on a
				// field; only an empty name asks for focus (autoFocus below).
				onOpenAutoFocus={(event) => event.preventDefault()}
			>
				{editing?.kind === "sheet" && (
					<SheetLessonForm
						key={`${lessonKey(editing.row)}#${editing.row.weeks.join(",")}`}
						row={editing.row}
						name={editing.name}
						weeks={teachingWeeks(semester)}
						semester={semester}
						week={week}
						onDone={close}
					/>
				)}
				{editing?.kind === "own" && (
					<OwnLessonForm
						key={editing.lesson?.id ?? "new"}
						edit={editing}
						weeks={teachingWeeks(semester)}
						semester={semester}
						onDone={close}
					/>
				)}
			</DialogContent>
		</Dialog>
	);
}

function SheetLessonForm(props: {
	row: LessonRow;
	name: string;
	weeks: ReadonlyArray<Week>;
	semester: Semester;
	/** The dated week on screen, when there is one: a change starts there. */
	week: Week | undefined;
	onDone: () => void;
}) {
	const { row, name, weeks, semester, week, onDone } = props;
	const overrides = usePlanDraft((state) => state.overrides);
	const setOverrides = usePlanDraft((state) => state.setOverrides);
	// What the sheet prints: the same fields as the row until it is corrected.
	const printed = row.printed ?? row;
	const whole = overrideOf(row, overrides);
	// The weeks the whole lesson runs, before any of them moved apart: the
	// row on the grid may be the part that moved, or what is left after one did.
	const lessonWeeks = whole?.weeks ?? printed.weeks;
	const isPart = row.split === true;
	const shown =
		week !== undefined && lessonWeeks.includes(week) ? week : undefined;
	// A teacher moves one pair, or a run of weeks, far more often than the
	// whole semester: a dated week on screen starts on that week alone.
	const [scope, setScope] = useState<"all" | "some">(
		isPart || (shown !== undefined && lessonWeeks.length > 1) ? "some" : "all",
	);
	const some = scope === "some";
	const [partWeeks, setPartWeeks] = useState<ReadonlyArray<Week>>(
		isPart ? row.weeks : shown === undefined ? [] : [shown],
	);
	const [runWeeks, setRunWeeks] = useState<ReadonlyArray<Week>>(lessonWeeks);
	const [day, setDay] = useState<Day>(row.day);
	const [slot, setSlot] = useState<BellSlot>(row.slot);
	const [room, setRoom] = useState(row.room ?? "");
	const fieldsSame =
		day === row.day && slot === row.slot && room.trim() === (row.room ?? "");
	// Weeks a part leaves go back to the lesson as it runs.
	const released = isPart
		? row.weeks.filter((w) => !partWeeks.includes(w))
		: [];
	const unchanged = some
		? fieldsSame && (!isPart || sameWeeks(partWeeks, row.weeks))
		: fieldsSame && sameWeeks(runWeeks, lessonWeeks);
	const nothingPicked = some && partWeeks.length === 0;
	const wholeKeys = [lessonKey(row), legacyKey(row)];

	const partChanges = (target: Override) => [
		...partWeeks.map((w) => [occurrenceKey(row, w), target] as const),
		...released.map((w) => [occurrenceKey(row, w), undefined] as const),
	];
	// A whole-lesson edit also drops a move saved before weeks joined the key.
	const wholeChanges = (target: Override | undefined) => [
		[wholeKeys[0]!, target] as const,
		[wholeKeys[1]!, undefined] as const,
	];

	const save = () => {
		const target: OverrideDraft = { day, slot };
		if (some) {
			// Some weeks keep what was saved even when it matches the sheet: the
			// teacher may hold them at the sheet's time while the rest moved.
			if (room.trim() !== (whole?.room ?? printed.room ?? ""))
				target.room = room.trim();
			setOverrides(partChanges(target));
		} else {
			// The whole lesson compares against the sheet, so going back to the
			// sheet drops the correction.
			if (!sameWeeks(runWeeks, printed.weeks)) target.weeks = [...runWeeks];
			if (room.trim() !== (printed.room ?? "")) target.room = room.trim();
			const backToSheet =
				day === printed.day &&
				slot === printed.slot &&
				target.weeks === undefined &&
				target.room === undefined;
			setOverrides(wholeChanges(backToSheet ? undefined : target));
		}
		onDone();
	};
	const blocked =
		unchanged || nothingPicked || (!some && runWeeks.length === 0);
	const cancel = () => {
		const notHeld = { day: row.day, slot: row.slot, weeks: [] };
		setOverrides(some ? partChanges(notHeld) : wholeChanges(notHeld));
		onDone();
	};
	const restore = () => {
		setOverrides(
			some
				? row.weeks.map((w) => [occurrenceKey(row, w), undefined] as const)
				: wholeChanges(undefined),
		);
		onDone();
	};

	return (
		<>
			<DialogHeader>
				<DialogTitle>Змінити пару</DialogTitle>
				<DialogDescription>
					{name}, {groupOf(row)}. Так буде на сітці, у накладках і в календарі.
				</DialogDescription>
			</DialogHeader>
			<div className="grid gap-4">
				{(isPart || lessonWeeks.length > 1) && (
					<ToggleGroup
						type="single"
						value={scope}
						onValueChange={(value) => {
							if (value === "all" || value === "some") setScope(value);
						}}
						aria-label="Для яких тижнів"
						spacing={1}
						className={`${SEGMENTED} w-full`}
						data-testid="edit-scope"
					>
						<ToggleGroupItem
							value="all"
							data-testid="edit-scope-all"
							className={`${SEGMENT} flex-1`}
						>
							Усі тижні
						</ToggleGroupItem>
						<ToggleGroupItem
							value="some"
							data-testid="edit-scope-some"
							className={`${SEGMENT} flex-1`}
						>
							Окремі тижні
						</ToggleGroupItem>
					</ToggleGroup>
				)}
				{some && (
					<WeeksField
						id="edit-part-weeks"
						label="Які тижні"
						hint="Решта тижнів лишаються як є."
						all={lessonWeeks}
						presets={[
							{
								label: "Непарні",
								weeks: lessonWeeks.filter((w) => w % 2 === 1),
							},
							{ label: "Парні", weeks: lessonWeeks.filter((w) => w % 2 === 0) },
						]}
						value={partWeeks}
						semester={semester}
						onChange={setPartWeeks}
					/>
				)}
				<WhenFields day={day} slot={slot} onDay={setDay} onSlot={setSlot} />
				<div className="flex flex-col gap-1.5">
					<Label htmlFor="edit-room">Аудиторія</Label>
					<Input
						id="edit-room"
						data-testid="edit-room"
						name="room"
						autoComplete="off"
						value={room}
						maxLength={80}
						placeholder="Наприклад, 1-225 або онлайн…"
						onChange={(event) => setRoom(event.target.value)}
						onKeyDown={(event) => {
							if (event.key === "Enter" && !blocked) save();
						}}
					/>
				</div>
				{!some && (
					<WeeksField
						id="edit-weeks"
						label="Тижні, коли пара є"
						all={[...new Set([...weeks, ...printed.weeks])].sort(
							(a, b) => a - b,
						)}
						presets={[
							{ label: "Як у файлі", weeks: printed.weeks },
							{
								label: "Непарні",
								weeks: printed.weeks.filter((w) => w % 2 === 1),
							},
							{
								label: "Парні",
								weeks: printed.weeks.filter((w) => w % 2 === 0),
							},
						]}
						value={runWeeks}
						semester={semester}
						onChange={setRunWeeks}
					/>
				)}
				{row.printed && (
					<p
						className="text-xs text-muted-foreground"
						data-testid="edit-printed"
					>
						У розкладі: {DAY_SHORT[printed.day]},{" "}
						{BELL_SLOTS.indexOf(printed.slot) + 1} пара, тижні{" "}
						{formatWeeks(printed.weeks)}
						{printed.room ? `, ауд. ${printed.room}` : ""}
					</p>
				)}
			</div>
			<DialogFooter className="gap-2 sm:justify-between">
				<div className="flex flex-wrap gap-1 max-sm:flex-col">
					{(some ? isPart : whole !== undefined) && (
						<Button
							size="compact"
							variant="ghost"
							onClick={restore}
							data-testid="edit-restore"
						>
							Як у розкладі
						</Button>
					)}
					<Button
						size="compact"
						variant="outline"
						onClick={cancel}
						disabled={nothingPicked}
						data-testid="edit-cancel-lesson"
					>
						{some ? "Цих тижнів пари не буде" : "Пари не буде"}
					</Button>
				</div>
				<Button
					size="compact"
					onClick={save}
					disabled={blocked}
					data-testid="edit-apply"
					className="max-sm:min-h-11"
				>
					Зберегти
				</Button>
			</DialogFooter>
		</>
	);
}

function OwnLessonForm(props: {
	edit: Extract<LessonEdit, { kind: "own" }>;
	weeks: ReadonlyArray<Week>;
	semester: Semester;
	onDone: () => void;
}) {
	const { edit, weeks, semester, onDone } = props;
	const saveCustom = usePlanDraft((state) => state.saveCustom);
	const removeCustom = usePlanDraft((state) => state.removeCustom);
	const saved = edit.lesson;
	// ІНП titles of guest courses run past 180 characters; a seed longer than
	// the plan accepts would make every later save fail.
	const [name, setName] = useState(
		(saved?.name ?? edit.name ?? "").slice(0, NAME_MAX),
	);
	const [day, setDay] = useState<Day>(saved?.day ?? "Понеділок");
	const [slot, setSlot] = useState<BellSlot>(saved?.slot ?? BELL_SLOTS[0]);
	const [room, setRoom] = useState(saved?.room ?? "");
	const [teacher, setTeacher] = useState(saved?.teacher ?? "");
	const [chosenWeeks, setChosenWeeks] = useState<ReadonlyArray<Week>>(
		saved?.weeks ?? weeks,
	);
	let missing: string | undefined;
	if (name.trim() === "") missing = "Напиши назву пари.";
	else if (chosenWeeks.length === 0) missing = "Обери хоча б один тиждень.";

	const save = () => {
		if (missing) return;
		const lesson: LessonDraft = {
			id: saved?.id ?? crypto.randomUUID(),
			name: name.trim(),
			day,
			slot,
			weeks: [...chosenWeeks],
		};
		if (room.trim()) lesson.room = room.trim();
		if (teacher.trim()) lesson.teacher = teacher.trim();
		const courseId = saved?.courseId ?? edit.courseId;
		if (courseId !== undefined) lesson.courseId = courseId;
		saveCustom(lesson);
		onDone();
	};
	const submitOnEnter = (event: React.KeyboardEvent<HTMLInputElement>) => {
		if (event.key === "Enter") save();
	};

	return (
		<>
			<DialogHeader>
				<DialogTitle>{saved ? "Змінити свою пару" : "Своя пара"}</DialogTitle>
				<DialogDescription>
					Для пар, яких немає в жодному файлі розкладу: консультація, курсова,
					предмет іншого факультету. Вона буде на сітці, у накладках і в
					календарі.
				</DialogDescription>
			</DialogHeader>
			<div className="grid gap-4">
				<div className="flex flex-col gap-1.5">
					<Label htmlFor="own-name">Назва</Label>
					<Input
						id="own-name"
						data-testid="own-name"
						name="name"
						autoComplete="off"
						value={name}
						maxLength={NAME_MAX}
						autoFocus={!edit.name && !saved}
						placeholder="Наприклад, Кваліфікаційна робота…"
						onChange={(event) => setName(event.target.value)}
						onKeyDown={submitOnEnter}
					/>
				</div>
				<WhenFields day={day} slot={slot} onDay={setDay} onSlot={setSlot} />
				<WeeksField
					id="own-weeks"
					label="Тижні"
					all={weeks}
					presets={[
						{ label: "Усі", weeks },
						{ label: "Непарні", weeks: weeks.filter((w) => w % 2 === 1) },
						{ label: "Парні", weeks: weeks.filter((w) => w % 2 === 0) },
					]}
					value={chosenWeeks}
					semester={semester}
					onChange={setChosenWeeks}
				/>
				<div className="grid grid-cols-2 gap-3">
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="own-room">Аудиторія</Label>
						<Input
							id="own-room"
							data-testid="own-room"
							name="room"
							autoComplete="off"
							value={room}
							maxLength={80}
							placeholder="Необов’язково"
							onChange={(event) => setRoom(event.target.value)}
							onKeyDown={submitOnEnter}
						/>
					</div>
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="own-teacher">Викладач</Label>
						<Input
							id="own-teacher"
							data-testid="own-teacher"
							name="teacher"
							autoComplete="off"
							value={teacher}
							maxLength={120}
							placeholder="Необов’язково"
							onChange={(event) => setTeacher(event.target.value)}
							onKeyDown={submitOnEnter}
						/>
					</div>
				</div>
			</div>
			<DialogFooter className="gap-2 sm:justify-between">
				{saved ? (
					<Button
						size="compact"
						variant="destructive"
						data-testid="own-delete"
						onClick={() => {
							undoable("Пару видалено", () => removeCustom([saved.id]));
							onDone();
						}}
					>
						Видалити пару
					</Button>
				) : (
					<span />
				)}
				<div className="flex items-center gap-3 max-sm:flex-col-reverse max-sm:items-stretch">
					{missing && (
						<span className="text-xs text-muted-foreground max-sm:text-center">
							{missing}
						</span>
					)}
					<Button
						size="compact"
						onClick={save}
						aria-disabled={missing !== undefined}
						data-testid="own-save"
						className="max-sm:min-h-11"
					>
						{saved ? "Зберегти" : "Додати"}
					</Button>
				</div>
			</DialogFooter>
		</>
	);
}

function WhenFields(props: {
	day: Day;
	slot: BellSlot;
	onDay: (day: Day) => void;
	onSlot: (slot: BellSlot) => void;
}) {
	const { day, slot, onDay, onSlot } = props;
	return (
		<div className="grid grid-cols-2 gap-3">
			<div className="flex flex-col gap-1.5">
				<Label htmlFor="edit-day">День</Label>
				<Select
					value={day}
					// SAFETY: the items below are DAYS, so the value is a Day.
					onValueChange={(value) => onDay(value as Day)}
				>
					<SelectTrigger
						id="edit-day"
						data-testid="edit-day"
						className="w-full"
					>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{DAYS.map((item) => (
							<SelectItem key={item} value={item}>
								{item}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
			<div className="flex flex-col gap-1.5">
				<Label htmlFor="edit-slot">Пара</Label>
				<Select
					value={slot}
					// SAFETY: the items below are BELL_SLOTS, so the value is a BellSlot.
					onValueChange={(value) => onSlot(value as BellSlot)}
				>
					<SelectTrigger
						id="edit-slot"
						data-testid="edit-slot"
						className="w-full"
					>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{BELL_SLOTS.map((item, index) => (
							<SelectItem key={item} value={item}>
								{index + 1} пара, {item.replace("-", "–")}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
		</div>
	);
}

/** A set of weeks: one chip per week, plus the patterns teachers actually
 *  announce, taken over the lesson's own span («only odd weeks» of a lesson
 *  printed for 3–9 is 3, 5, 7, 9). */
function WeeksField(props: {
	id: string;
	label: string;
	/** One quiet line under the chips. */
	hint?: string;
	all: ReadonlyArray<Week>;
	presets: ReadonlyArray<{
		readonly label: string;
		readonly weeks: ReadonlyArray<Week>;
	}>;
	value: ReadonlyArray<Week>;
	semester: Semester;
	onChange: (weeks: ReadonlyArray<Week>) => void;
}) {
	const { id, label, hint, all, presets, value, semester, onChange } = props;
	return (
		<div className="flex flex-col gap-1.5">
			<div className="flex items-center gap-2">
				<Label id={`${id}-label`}>{label}</Label>
				<span className="ml-auto flex gap-1">
					{presets.map((preset) => (
						<Button
							key={preset.label}
							variant={sameWeeks(value, preset.weeks) ? "secondary" : "ghost"}
							size="xs"
							className="pointer-coarse:h-8 pointer-coarse:px-2.5"
							onClick={() => onChange(preset.weeks)}
							data-testid={`${id}-${preset.label}`}
						>
							{preset.label}
						</Button>
					))}
				</span>
			</div>
			<ToggleGroup
				type="multiple"
				variant="outline"
				size="sm"
				spacing={1}
				aria-labelledby={`${id}-label`}
				data-testid={id}
				value={value.map(String)}
				// SAFETY: every item value below is a Week from `all`.
				onValueChange={(next) =>
					onChange(next.map(Number).sort((a, b) => a - b) as Week[])
				}
				className="w-full flex-wrap"
			>
				{all.map((week) => {
					const span = semester.weekDates.get(week);
					return (
						<ToggleGroupItem
							key={week}
							value={String(week)}
							aria-label={`Тиждень ${week}`}
							title={span ? formatSpan(span.start, span.end) : undefined}
							className="w-8 tabular-nums pointer-coarse:h-10 pointer-coarse:w-10 data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
						>
							{week}
						</ToggleGroupItem>
					);
				})}
			</ToggleGroup>
			{hint && <p className="text-xs text-muted-foreground">{hint}</p>}
		</div>
	);
}

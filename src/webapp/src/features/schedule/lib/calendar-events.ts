import type {
	Day,
	DisciplineId,
	GroupLabel,
	LessonRow,
	Offering,
	Plan,
	Selection,
	Week,
} from "@/features/schedule/core";
import {
	BELL_SLOTS,
	DAYS,
	clockOf,
	dateOfDayInWeek,
	describeWhen,
	explainGroup,
	groupOf,
	overlaps,
	placeOf,
	timeOf,
} from "@/features/schedule/core";
import type { Semester } from "@/features/schedule/lib/data";
import {
	DAY_SHORT,
	describeRow,
	formatWeeks,
	shortName,
} from "@/features/schedule/lib/format";
import {
	localIsoDate,
	nowMarkOf,
	weekPatternOf,
} from "@/features/schedule/lib/weeks";
import type { ViewMode } from "@/features/schedule/stores/ui";

export type EventStatus = "lecture" | "chosen" | "open" | "infeasible" | "full";

export interface CalendarEvent {
	readonly row: LessonRow;
	readonly offering: Offering;
	readonly group: GroupLabel | undefined;
	readonly status: EventStatus;
	/** The only group of its discipline the plan can take: unchoosing it is a no-op. */
	readonly forced: boolean;
}

export const EVENT_STYLE = {
	lecture:
		"border-transparent border-l-[3px] border-l-primary/40 bg-primary/8 text-foreground",
	chosen:
		"border-primary bg-primary text-primary-foreground shadow-md shadow-primary/25",
	open: "border-border bg-card text-foreground hover:border-primary/50 hover:shadow-sm",
	infeasible: "border-transparent bg-muted/70 text-muted-foreground",
	full: "border-warning/30 bg-warning/14 text-warning",
} satisfies Record<EventStatus, string>;

/** Another group of the discipline is chosen: it stays on the grid to switch
 *  to, drawn as an outline so the chosen group reads first. The text keeps
 *  its contrast; an opacity fade made the alternatives unreadable. */
export const ALTERNATIVE_STYLE =
	"border-dashed border-border bg-transparent text-muted-foreground hover:border-primary/50 hover:bg-card hover:text-foreground";

/** One lesson card's colours, the same on the grid and on the phone. */
export const cardStyle = (
	status: EventStatus,
	options: {
		/** Another group of this discipline is chosen; only a group that fits
		 *  the plan is drawn as one to switch to. */
		readonly alternative: boolean;
		readonly clash: boolean;
		/** The rail points at another discipline: this one steps back. */
		readonly dimmed: boolean;
	},
): string =>
	[
		options.alternative && status === "open"
			? ALTERNATIVE_STYLE
			: EVENT_STYLE[status],
		options.clash ? "ring-1 ring-destructive/50" : "",
		options.dimmed ? "opacity-25" : "",
	]
		.filter(Boolean)
		.join(" ");

export interface CalendarModel {
	readonly events: ReadonlyArray<CalendarEvent>;
	/** Every active lesson that lands on another one, with the lessons it lands on. */
	readonly clashing: ReadonlyMap<CalendarEvent, ReadonlyArray<CalendarEvent>>;
	readonly days: ReadonlyArray<Day>;
	readonly slots: ReadonlyArray<string>;
	/** Week- and solo-filtered, before the clashes view narrows it. */
	readonly dated: ReadonlyArray<CalendarEvent>;
	readonly visible: ReadonlyArray<CalendarEvent>;
	readonly todayColumn: Day | undefined;
	/** Today's column only: the row the "now" line crosses and how far down. */
	readonly nowMark:
		| { readonly slot: string; readonly fraction: number }
		| undefined;
	readonly span: { readonly start: string; readonly end: string } | undefined;
}

export interface SplitName {
	readonly main: string;
	readonly variant: string | undefined;
}

/** Text tone of the meta line under an event name, per status. */
export const metaTone = (status: EventStatus): string =>
	status === "chosen"
		? "text-primary-foreground/80"
		: status === "full"
			? "text-warning/90"
			: status === "infeasible"
				? "text-muted-foreground/90"
				: "text-muted-foreground";

/** The «накладка» pill after the meta line, toned to its cell. */
export const clashTone = (status: EventStatus): string =>
	`ml-1.5 inline-block rounded-sm px-1 py-px text-mini font-medium ${
		status === "chosen"
			? "bg-white/20 text-primary-foreground"
			: status === "full"
				? "bg-warning/15 text-warning"
				: "bg-destructive/10 text-destructive"
	}`;

/** The display name split from its variant suffix, so a view can show both
 *  without the « · » glue and without truncating either. */
export const splitName = (name: string): SplitName => {
	const [main, variant] = name.split(" · ");
	return { main: main ?? name, variant };
};

/**
 * Every lecture and every candidate group of the picked disciplines, with the
 * clash marks the grid and the phone day view both render. One computation,
 * two presentations.
 */
export const computeCalendarModel = (
	offerings: ReadonlyArray<Offering>,
	result: Plan,
	selection: Selection,
	semester: Semester,
	hidden: ReadonlySet<DisciplineId>,
	solo: DisciplineId | undefined,
	view: ViewMode,
	week: Week | undefined,
	now: Date,
): CalendarModel => {
	const events: CalendarEvent[] = [];
	const byDiscipline = new Map(
		result.disciplines.map((d) => [d.disciplineId, d]),
	);
	// A hidden discipline is not attended: it explains no struck group.
	const attended = offerings.filter(
		(offering) => !hidden.has(offering.disciplineId),
	);
	for (const offering of offerings) {
		if (hidden.has(offering.disciplineId)) continue;
		const entry = byDiscipline.get(offering.disciplineId);
		if (!entry) continue;
		for (const row of offering.lectures) {
			events.push({
				row,
				offering,
				group: undefined,
				status: "lecture",
				forced: false,
			});
		}
		const chosenGroup = selection[offering.disciplineId];
		// Solo exists to compare alternatives — never collapse them away in it.
		const shownGroups =
			view === "chosen" &&
			offering.disciplineId !== solo &&
			chosenGroup !== undefined &&
			entry.candidates.includes(chosenGroup)
				? [chosenGroup]
				: entry.candidates;
		const feasibleGroups = new Set(entry.feasible);
		const fullGroups = new Set(entry.full);
		for (const group of shownGroups) {
			const rows = offering.groups[group] ?? [];
			const chosen = selection[offering.disciplineId] === group;
			const feasible = result.satisfiable
				? feasibleGroups.has(group)
				: explainGroup(attended, offering.disciplineId, group).length === 0;
			const status: EventStatus = chosen
				? "chosen"
				: fullGroups.has(group)
					? "full"
					: feasible
						? "open"
						: "infeasible";
			const forced = entry.forced && entry.feasible[0] === group;
			for (const row of rows) {
				events.push({ row, offering, group, status, forced });
			}
		}
	}

	// Two *active* lessons (a lecture, or the group actually chosen) landing on
	// the same time is a real clash — mark both, loudly. In a dated week only
	// the collisions that happen that week count; the whole-semester view
	// shows every collision there is.
	const active = events.filter(
		(event) => event.status === "lecture" || event.status === "chosen",
	);
	const clashing = new Map<CalendarEvent, CalendarEvent[]>();
	const note = (event: CalendarEvent, other: CalendarEvent) =>
		clashing.set(event, [...(clashing.get(event) ?? []), other]);
	const collide = (a: CalendarEvent, b: CalendarEvent): boolean =>
		a.offering.disciplineId !== b.offering.disciplineId &&
		overlaps(a.row, b.row) &&
		(week === undefined ||
			(a.row.weeks.includes(week) && b.row.weeks.includes(week)));
	for (let i = 0; i < active.length; i++) {
		for (let j = i + 1; j < active.length; j++) {
			const a = active[i]!;
			const b = active[j]!;
			if (collide(a, b)) {
				note(a, b);
				note(b, a);
			}
		}
	}

	// The frame is the working week plus any weekend the picked disciplines
	// use, whatever the eye, view or week currently leaves in the cells: an
	// empty Вівторок is information, a vanishing column is a jump.
	const lessonDays = new Set<Day>();
	for (const offering of offerings) {
		for (const row of offering.lectures) lessonDays.add(row.day);
		for (const rows of Object.values(offering.groups)) {
			for (const row of rows) lessonDays.add(row.day);
		}
	}
	const days = DAYS.filter((day, index) => index < 5 || lessonDays.has(day));
	const lastSlot = Math.max(
		5,
		...events.map((event) => rowSpanOf(event.row).last),
	);
	const slots = BELL_SLOTS.slice(0, lastSlot + 1);
	const span = week === undefined ? undefined : semester.weekDates.get(week);
	// Solo and the week picker only filter cells; the day/slot frame stays put.
	const soloed =
		solo === undefined
			? events
			: events.filter((event) => event.offering.disciplineId === solo);
	const dated =
		week === undefined
			? soloed
			: soloed.filter((event) => event.row.weeks.includes(week));
	// The clashes view answers one question — where do lessons collide — so it
	// keeps the colliding cells and nothing else.
	const visible =
		view === "clashes" ? dated.filter((event) => clashing.has(event)) : dated;
	// In a dated week, today's column and the pair running right now stand out.
	const today = localIsoDate(now);
	const todayColumn =
		span && today >= span.start && today <= span.end
			? days.find((day) => dateOfDayInWeek(span.start, span.end, day) === today)
			: undefined;
	const nowMark = todayColumn === undefined ? undefined : nowMarkOf(slots, now);

	return {
		events,
		clashing,
		days,
		slots,
		dated,
		visible,
		todayColumn,
		nowMark,
		span,
	};
};

/** Where a lesson runs on the bell rows: from `top` of row `first` down to
 *  `bottom` of row `last`, each a fraction of its row. A break between two
 *  pairs has no height, as for the "now" line: «13:00-14:50» fills the 4th
 *  row, «10:40-11:20» the lower half of the 2nd. */
export interface RowSpan {
	readonly first: number;
	readonly last: number;
	readonly top: number;
	readonly bottom: number;
}

const minutesOf = (clock: string): number => {
	const [hours, minutes] = clock.split(":");
	return Number(hours) * 60 + Number(minutes);
};

const BELL_MINUTES = BELL_SLOTS.map((slot) => {
	const [start, end] = slot.split("-");
	return { start: minutesOf(start!), end: minutesOf(end!) };
});

/** A clock as a position down the rows: 1.5 is half-way through row 1. */
const rowPosition = (clock: string): number => {
	const minute = minutesOf(clock);
	for (const [index, bell] of BELL_MINUTES.entries()) {
		if (minute < bell.start) return index;
		if (minute <= bell.end)
			return index + (minute - bell.start) / (bell.end - bell.start);
	}
	return BELL_MINUTES.length;
};

export const rowSpanOf = (row: LessonRow): RowSpan => {
	const time = timeOf(row);
	const from = rowPosition(time.start);
	const to = rowPosition(time.end);
	// A lesson wholly inside a break keeps the bell slot the sheet gave it.
	if (to <= from) {
		const anchor = BELL_SLOTS.indexOf(row.slot);
		return { first: anchor, last: anchor, top: 0, bottom: 1 };
	}
	const first = Math.min(Math.floor(from), BELL_SLOTS.length - 1);
	const last = Math.max(first, Math.ceil(to) - 1);
	return { first, last, top: from - first, bottom: to - last };
};

/** The row an off-grid card writes its text in: its bell slot, the cell
 *  the keyboard, the editor and the overrides know it by. */
export const textRowOf = (row: LessonRow, span: RowSpan): number => {
	const anchor = BELL_SLOTS.indexOf(row.slot);
	return anchor >= span.first && anchor <= span.last ? anchor : span.first;
};

/** An off-grid lesson on one day of the grid, in its side-by-side lane. */
export interface PlacedEvent {
	readonly event: CalendarEvent;
	readonly span: RowSpan;
	readonly lane: number;
	readonly textRow: number;
}

export interface DayLayout {
	readonly placed: ReadonlyArray<PlacedEvent>;
	/** How many off-grid lessons run side by side at most. */
	readonly lanes: number;
	/** Rows an off-grid lesson covers. */
	readonly covered: ReadonlySet<number>;
	/** A bell lesson sits where an off-grid card writes its text, so the bell
	 *  lessons take a column of their own beside the cards. */
	readonly shared: boolean;
}

/**
 * Lays out one day's off-grid lessons (those with a printed `time`) over
 * the bell rows: each spans the rows its clock covers and overlapping ones
 * go side by side. A bell lesson in a covered row is drawn over the card,
 * indented so the card shows beside it, the way a calendar app stacks a
 * meeting on an all-day block; only where it would hide a card's text do
 * the bell lessons get a column of their own.
 */
export const layoutDay = (
	offGrid: ReadonlyArray<CalendarEvent>,
	bellRows: ReadonlySet<number>,
): DayLayout => {
	const spans = offGrid
		.map((event) => ({ event, span: rowSpanOf(event.row) }))
		.sort(
			(a, b) =>
				a.span.first + a.span.top - (b.span.first + b.span.top) ||
				b.span.last + b.span.bottom - (a.span.last + a.span.bottom),
		);
	const laneEnds: number[] = [];
	const placed = spans.map(({ event, span }): PlacedEvent => {
		const start = span.first + span.top;
		const free = laneEnds.findIndex((end) => end <= start);
		const lane = free < 0 ? laneEnds.length : free;
		laneEnds[lane] = span.last + span.bottom;
		return { event, span, lane, textRow: textRowOf(event.row, span) };
	});
	const covered = new Set<number>();
	for (const { span } of placed) {
		for (let index = span.first; index <= span.last; index++)
			covered.add(index);
	}
	return {
		placed,
		lanes: laneEnds.length,
		covered,
		shared: placed.some(({ textRow }) => bellRows.has(textRow)),
	};
};

/** One line under a corrected lesson saying what the student changed, so a
 *  lesson that differs from the sheet never looks like the sheet's. */
export const editedNoteOf = (row: LessonRow): string | undefined => {
	const printed = row.printed;
	if (!printed) return undefined;
	if (printed.day !== row.day || printed.slot !== row.slot)
		return `перенесено з ${DAY_SHORT[printed.day]}, ${BELL_SLOTS.indexOf(printed.slot) + 1} пара`;
	// Weeks alone need no note: the weeks label says them, and the weeks left
	// after one of them moved away are the lesson as it runs.
	if ((printed.room ?? "") !== (row.room ?? "")) return "змінено вручну";
	return undefined;
};

/** Weeks before the place: «1-313» next to «2–12» reads as one number.
 *  Parts, so a narrow cell wraps between them and never inside «тижні 2–12». */
export const eventMetaParts = (
	event: CalendarEvent,
	semester: Semester,
	singleWeek: boolean,
): ReadonlyArray<string> => {
	const { row } = event;
	const pattern = weekPatternOf(row.weeks, semester.weekDates);
	const place = placeOf(row);
	return [
		groupOf(row),
		// An off-grid lesson says when it really runs.
		...(row.time === undefined ? [] : [clockOf(timeOf(row))]),
		// Every-week lessons show no weeks line; the rest say «тижні», so a group
		// number and a week list never run together («гр. 4, 3, 5, 7»).
		...(singleWeek || pattern.kind === "every" ? [] : [pattern.label]),
		...(place ? [place] : []),
	];
};

export const eventMeta = (
	event: CalendarEvent,
	semester: Semester,
	singleWeek: boolean,
): string => eventMetaParts(event, semester, singleWeek).join(", ");

export interface HintContext {
	readonly offerings: ReadonlyArray<Offering>;
	readonly semester: Semester;
	readonly singleWeek: boolean;
	readonly names: ReadonlyMap<string, string>;
	/** The active lessons this one lands on, from `CalendarModel.clashing`. */
	readonly partners: ReadonlyArray<CalendarEvent>;
	readonly readOnly: boolean;
}

const sideOf = (row: LessonRow, names: ReadonlyMap<string, string>): string =>
	`«${shortName(names.get(row.disciplineId) ?? row.discipline)}», ${groupOf(row)}`;

const sharedWeeks = (a: LessonRow, b: LessonRow): ReadonlyArray<Week> => {
	const bWeeks = new Set(b.weeks);
	return a.weeks.filter((week) => bWeeks.has(week));
};

/** Deduplicated teachers behind an event's rows. */
const teachersOf = (rows: ReadonlyArray<LessonRow>): ReadonlyArray<string> => {
	const seen: Array<string> = [];
	for (const row of rows) {
		const teacher = row.teacher?.trim();
		if (teacher && !seen.includes(teacher)) seen.push(teacher);
	}
	return seen;
};

/** The desktop tooltip and the phone sheet render the same text: teacher
 *  first when named, then what the lesson lands on or why it is struck. */
export const eventHint = (
	event: CalendarEvent,
	context: HintContext,
): string => {
	const { offering, group, status } = event;
	const { names } = context;
	const rows =
		group === undefined ? [event.row] : (offering.groups[group] ?? []);
	const teachers = teachersOf(rows);
	const teacherLine =
		teachers.length === 1
			? `Викладач: ${teachers[0]}`
			: teachers.length > 0
				? `Викладачі: ${teachers.join("; ")}`
				: "";
	const withTeacher = (body: string) =>
		[teacherLine, body].filter((line) => line !== "").join("\n");
	if (context.partners.length > 0) {
		return withTeacher(
			context.partners
				.map(
					(other) =>
						`Накладається на ${sideOf(other.row, names)}: ${describeWhen(other.row)}, тижні ${formatWeeks(sharedWeeks(event.row, other.row))}`,
				)
				.join("\n"),
		);
	}
	if (group === undefined) return withTeacher(describeRow(event.row));
	if (status === "full") return withTeacher("Немає вільних місць.");
	if (status === "infeasible") {
		return withTeacher(
			explainGroup(context.offerings, offering.disciplineId, group)
				.map(
					(item) =>
						`Не поєднується з планом: накладається на ${sideOf(item.b, names)}, ${describeWhen(item.b)}, тижні ${formatWeeks(item.weeks)}`,
				)
				.join("\n") ||
				"Не поєднується з планом: жодна повна комбінація груп її не містить.",
		);
	}
	const lessons = rows.map(describeRow).join("; ");
	if (status !== "chosen") return withTeacher(lessons);
	if (event.forced)
		return withTeacher(
			`${lessons}\nЄдина група, що поєднується з рештою плану.`,
		);
	return withTeacher(
		context.readOnly
			? lessons
			: `${lessons}\nКлік знімає вибір і повертає інші групи.`,
	);
};

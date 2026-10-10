import type React from "react";
import type {
	Day,
	DisciplineId,
	GroupLabel,
	LessonRow,
	Offering,
	Selection,
	Week,
	InpResolution,
} from "@/features/schedule/core";
import {
	DAYS,
	clockOf,
	dateOfDayInWeek,
	lessonKey,
	timeOf,
} from "@/features/schedule/core";
import { Check, ChevronLeft, ChevronRight, Info } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Sheet, SheetContent } from "@/components/ui/Sheet";
import { EmptyPlan, NoClashes } from "@/features/schedule/components/EmptyPlan";
import { PhoneLessonSheet } from "@/features/schedule/components/PhoneLessonSheet";
import { useCalendarModel } from "@/features/schedule/hooks/useCalendarModel";
import type { Timetable } from "@/features/schedule/lib/plan-view";
import type { Semester } from "@/features/schedule/lib/data";
import {
	cardStyle,
	clashTone,
	editedNoteOf,
	eventMeta,
	metaTone,
	rowSpanOf,
	type CalendarEvent,
	type EventStatus,
} from "@/features/schedule/lib/calendar-events";
import { DAY_SHORT, shortDate } from "@/features/schedule/lib/format";
import { displayShort } from "@/features/schedule/lib/names";
import { provenanceOf } from "@/features/schedule/lib/provenance";
import { SheetBadge } from "@/features/schedule/components/SheetBadge";
import {
	ChangePill,
	CHANGED_STYLE,
} from "@/features/schedule/components/ChangeMarks";
import { useChangeMarks } from "@/features/schedule/hooks/useLessonChanges";
import {
	currentWeekOf,
	localIsoDate,
	stepWeek,
	weekdayOf,
} from "@/features/schedule/lib/weeks";
import { useUi, type ViewMode } from "@/features/schedule/stores/ui";

interface Props {
	planner: Timetable;
	onChoose: (disciplineId: DisciplineId, group: GroupLabel) => void;
	/** The plan is locked: lessons open their sheet, but nothing there changes the plan. */
	readOnly?: boolean;
	/** The agenda scroll container, for the PNG export to rasterise what is on screen. */
	phoneRef?: React.RefObject<HTMLDivElement | null>;
	/** Empty plan CTA: open the discipline catalog. */
	onBrowse?: () => void;
	/** Open the lesson editor; absent on a shared page. */
	onEdit?: (row: LessonRow, name: string) => void;
}

/** One lesson on the agenda, telling apart what shares a cell: a part of a
 *  lesson moved for some weeks and its rest, two own lessons in one slot. */
const lessonIdOf = (event: CalendarEvent): string =>
	[
		lessonKey(event.row),
		event.group ?? "",
		event.row.day,
		event.row.slot,
		event.row.weeks.join(","),
		event.row.custom ?? "",
	].join("|");

/**
 * The phone timetable: the whole picked week as one scrolling agenda, each
 * day a headed section, every lesson a full-width row. Same events and
 * clash marks as the desktop grid, only the presentation branches.
 */
export function PhoneDayView(props: Props) {
	const {
		planner,
		onChoose,
		readOnly = false,
		phoneRef,
		onBrowse,
		onEdit,
	} = props;
	const {
		pickedOfferings: offerings,
		effective: selection,
		displayNames: names,
		semester,
		shownView: view,
	} = planner;
	const { focus, week, solo, setWeek, todayTick } = useUi();
	const model = useCalendarModel(planner);
	const { clashing, visible, todayColumn, span } = model;

	const {
		day,
		todayDay,
		agendaDays,
		agendaRef,
		registerSection,
		onAgendaScroll,
		scrollToDay,
		stepWeekTo,
		edgePrev,
		edgeNext,
	} = useAgenda({
		dated: visible,
		semester,
		todayColumn,
		week,
		weeks: planner.weeks,
		setWeek,
		view,
		solo,
		todayTick,
	});

	const [sheetKey, setSheetKey] = useState<string>();
	const sheetEvent =
		sheetKey === undefined
			? undefined
			: visible.find((event) => lessonIdOf(event) === sheetKey);

	if (!semester || offerings.length === 0) {
		return <EmptyPlan onBrowse={onBrowse} />;
	}

	if (agendaDays.length === 0) {
		return (
			<div
				data-testid="planner-calendar"
				ref={phoneRef}
				className="px-6 py-10 text-center"
			>
				<p className="text-sm font-medium text-foreground">
					Цього тижня твоїх пар немає.
				</p>
				<p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
					Глянь інший тиждень або весь семестр.
				</p>
			</div>
		);
	}
	// One pass over the visible events: every (day, time) bucket below reads
	// its own lessons, instead of each scanning the whole list again. A lesson
	// printed off the bell grid heads its own bucket, at its own clock.
	const byDaySlot = new Map<string, CalendarEvent[]>();
	for (const event of visible) {
		const cell = `${event.row.day}|${event.row.time ?? event.row.slot}`;
		const bucket = byDaySlot.get(cell);
		if (bucket) bucket.push(event);
		else byDaySlot.set(cell, [event]);
	}

	return (
		<div data-testid="planner-calendar" className="flex h-full flex-col">
			{view === "clashes" && clashing.size === 0 && <NoClashes />}
			<div
				ref={(node) => {
					agendaRef.current = node;
					if (phoneRef) phoneRef.current = node;
				}}
				onScroll={onAgendaScroll}
				data-testid="day-panels"
				className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 pt-1 pb-[max(1rem,env(safe-area-inset-bottom))]"
			>
				{agendaDays.map((agendaDay) => (
					<DaySection
						key={agendaDay}
						agendaDay={agendaDay}
						sectionRef={registerSection(agendaDay)}
						date={
							span !== undefined
								? dateOfDayInWeek(span.start, span.end, agendaDay)
								: undefined
						}
						today={agendaDay === todayDay}
						byDaySlot={byDaySlot}
						clashing={clashing}
						focus={focus}
						selection={selection}
						names={names}
						semester={semester}
						singleWeek={week !== undefined}
						clashesOnly={view === "clashes"}
						offerings={planner.lessons.offerings}
						onChoose={onChoose}
						readOnly={readOnly}
						inp={planner.inp}
						onSwitchStream={planner.switchStream}
						onInfo={(event) => setSheetKey(lessonIdOf(event))}
					/>
				))}
			</div>
			<DayDock
				activeDay={day}
				agendaDays={agendaDays}
				todayDay={todayDay}
				onJump={scrollToDay}
				weekPrev={edgePrev}
				weekNext={edgeNext}
				onWeekPrev={() => stepWeekTo(-1)}
				onWeekNext={() => stepWeekTo(1)}
			/>
			<Sheet
				open={sheetEvent !== undefined}
				onOpenChange={(open) => {
					if (!open) setSheetKey(undefined);
				}}
			>
				<SheetContent
					side="bottom"
					data-testid="lesson-sheet"
					className="max-h-[85svh] overflow-y-auto overscroll-y-contain px-5 pt-2 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
				>
					{sheetEvent !== undefined && (
						<PhoneLessonSheet
							event={sheetEvent}
							partners={clashing.get(sheetEvent) ?? []}
							names={names}
							semester={semester}
							singleWeek={week !== undefined}
							offerings={planner.lessons.offerings}
							onChoose={onChoose}
							readOnly={readOnly}
							inp={planner.inp}
							onSwitchStream={planner.switchStream}
							onEdit={
								onEdit &&
								((row, name) => {
									setSheetKey(undefined);
									onEdit(row, name);
								})
							}
							onClose={() => setSheetKey(undefined)}
						/>
					)}
				</SheetContent>
			</Sheet>
		</div>
	);
}

function DaySection(props: {
	agendaDay: Day;
	sectionRef: (node: HTMLElement | null) => void;
	date: string | undefined;
	today: boolean;
	byDaySlot: ReadonlyMap<string, ReadonlyArray<CalendarEvent>>;
	clashing: ReadonlyMap<CalendarEvent, ReadonlyArray<CalendarEvent>>;
	focus: DisciplineId | undefined;
	selection: Selection;
	names: ReadonlyMap<string, string>;
	semester: Semester;
	singleWeek: boolean;
	clashesOnly: boolean;
	offerings: ReadonlyArray<Offering>;
	onChoose: Props["onChoose"];
	readOnly: boolean;
	onInfo: (event: CalendarEvent) => void;
	inp: InpResolution | undefined;
	onSwitchStream: (from: DisciplineId, to: DisciplineId) => void;
}) {
	const {
		inp,
		onSwitchStream,
		agendaDay,
		sectionRef,
		date,
		today,
		byDaySlot,
		clashing,
		focus,
		selection,
		names,
		semester,
		singleWeek,
		clashesOnly,
		offerings,
		onChoose,
		readOnly,
		onInfo,
	} = props;
	const slots = [...byDaySlot.entries()]
		.filter(([cell]) => cell.startsWith(`${agendaDay}|`))
		.map(([cell, events]) => ({
			key: cell,
			events,
			time: timeOf(events[0]!.row),
			span: rowSpanOf(events[0]!.row),
			offGrid: events[0]!.row.time !== undefined,
		}))
		.sort(
			(a, b) =>
				a.time.start.localeCompare(b.time.start) ||
				a.time.end.localeCompare(b.time.end),
		);
	return (
		<section
			data-testid={`day-panel-${agendaDay}`}
			ref={sectionRef}
			// The last day is at least a screen tall, so a jump to it can bring it
			// to the top and the dock marks the day that is actually on screen.
			className="scroll-mt-1 pt-1 last:min-h-full"
		>
			<h2
				data-testid="day-title"
				className="sticky top-0 z-10 flex items-center gap-1.5 border-b border-border/60 bg-background px-1 py-1"
			>
				<span className="text-sm font-semibold text-foreground">
					{agendaDay}
				</span>
				{date !== undefined && (
					<span className="tabular-nums text-xs text-muted-foreground">
						{shortDate(date)}
					</span>
				)}
				{today && (
					<span className="rounded-full bg-primary/10 px-2 py-0.5 text-meta font-medium text-primary">
						Сьогодні
					</span>
				)}
			</h2>
			{slots.length === 0 ? (
				<p className="px-1 py-4 text-center text-xs text-muted-foreground">
					{clashesOnly ? "Цього дня накладок немає." : "Цього дня пар немає."}
				</p>
			) : (
				<div className="py-2">
					{slots.map(({ key, events, time, span, offGrid }) => {
						const pairs =
							span.first === span.last
								? `${span.first + 1} пара`
								: `${span.first + 1}–${span.last + 1} пара`;
						return (
							<div key={key} className="mb-3" data-testid="agenda-time">
								{/* Off the bell grid the clock leads and the pairs it covers
                    follow, so the heading never names a time it does not run. */}
								<div className="mb-1 flex items-baseline gap-2 px-1">
									<span
										className={
											offGrid
												? "tabular-nums text-xs font-medium text-foreground/80"
												: "text-xs font-medium text-foreground/80"
										}
									>
										{offGrid ? clockOf(time) : pairs}
									</span>
									<span
										className={
											offGrid
												? "text-meta text-muted-foreground"
												: "tabular-nums text-meta text-muted-foreground"
										}
									>
										{offGrid ? pairs : clockOf(time)}
									</span>
								</div>
								{events.map((event, eventIndex) => (
									<PhoneLessonRow
										key={eventIndex}
										event={event}
										partners={clashing.get(event) ?? []}
										dimmed={
											focus !== undefined &&
											event.offering.disciplineId !== focus
										}
										muted={
											event.group !== undefined &&
											event.status !== "chosen" &&
											selection[event.offering.disciplineId] !== undefined
										}
										names={names}
										semester={semester}
										singleWeek={singleWeek}
										offerings={offerings}
										onChoose={onChoose}
										readOnly={readOnly}
										inp={inp}
										onSwitchStream={onSwitchStream}
										onInfo={() => onInfo(event)}
									/>
								))}
							</div>
						);
					})}
				</div>
			)}
		</section>
	);
}

/**
 * The bottom dock: every day with lessons as a jump chip, flanked by week
 * arrows. Chips jump within the week (day travel); the arrows cross weeks
 * and stay disabled at the semester's ends. Both stay vs the toolbar:
 * toolbar arrows = week travel, dock = day travel with edge week steps.
 */
function DayDock(props: {
	activeDay: Day | undefined;
	agendaDays: ReadonlyArray<Day>;
	todayDay: Day | undefined;
	onJump: (day: Day) => void;
	weekPrev: Week | undefined;
	weekNext: Week | undefined;
	onWeekPrev: () => void;
	onWeekNext: () => void;
}) {
	const {
		activeDay,
		agendaDays,
		todayDay,
		onJump,
		weekPrev,
		weekNext,
		onWeekPrev,
		onWeekNext,
	} = props;
	return (
		<nav
			aria-label="Дні"
			className="flex shrink-0 items-center gap-1 border-t border-border/60 bg-card px-1 py-1 pb-[calc(0.25rem+env(safe-area-inset-bottom))]"
		>
			<Button
				variant="ghost"
				size="icon-compact"
				data-testid="dock-week-prev"
				aria-label={
					weekPrev !== undefined
						? `Попередній тиждень, ${weekPrev}`
						: "Попередній тиждень"
				}
				disabled={weekPrev === undefined}
				onClick={onWeekPrev}
				className="min-h-11 min-w-11 shrink-0 rounded-md text-foreground"
			>
				<ChevronLeft className="size-5" />
			</Button>
			<div
				data-testid="day-chips"
				className="flex min-w-0 flex-1 items-center justify-center-safe gap-1 overflow-x-auto px-0.5"
			>
				{agendaDays.map((chipDay) => {
					const active = chipDay === activeDay;
					return (
						<Button
							key={chipDay}
							variant={active ? "secondary" : "ghost"}
							size="xs"
							data-testid={`day-chip-${chipDay}`}
							data-active={active || undefined}
							aria-label={chipDay}
							aria-current={active || undefined}
							onClick={() => onJump(chipDay)}
							className={`min-h-11 shrink-0 gap-1 px-2.5 text-xs ${
								active
									? "bg-secondary font-semibold text-secondary-foreground"
									: "font-medium text-muted-foreground"
							} ${chipDay === todayDay && !active ? "font-bold text-foreground" : ""}`}
						>
							{DAY_SHORT[chipDay] ?? chipDay}
							{chipDay === todayDay && (
								<span
									aria-hidden="true"
									className={`size-1 shrink-0 rounded-full ${active ? "bg-secondary-foreground" : "bg-primary"}`}
								/>
							)}
						</Button>
					);
				})}
			</div>
			<Button
				variant="ghost"
				size="icon-compact"
				data-testid="dock-week-next"
				aria-label={
					weekNext !== undefined
						? `Наступний тиждень, ${weekNext}`
						: "Наступний тиждень"
				}
				disabled={weekNext === undefined}
				onClick={onWeekNext}
				className="min-h-11 min-w-11 shrink-0 rounded-md text-foreground"
			>
				<ChevronRight className="size-5" />
			</Button>
		</nav>
	);
}

/** The agenda's days and the travel between them: chips jump within the
 *  week, the edge steps open the neighbouring week on its edge day. Owns
 *  the scroll spy, so the dock always marks the day on screen. */
const useAgenda = (args: {
	/** What the grid shows now: in «Накладки», only the colliding lessons. */
	dated: ReadonlyArray<CalendarEvent>;
	semester: Semester | undefined;
	todayColumn: Day | undefined;
	week: Week | undefined;
	weeks: ReadonlyArray<Week>;
	setWeek: (week: Week | undefined) => void;
	view: ViewMode;
	solo: DisciplineId | undefined;
	/** Bumped by «Сьогодні»: land on today even inside the same week. */
	todayTick: number;
}) => {
	const {
		dated,
		semester,
		todayColumn,
		week,
		weeks,
		setWeek,
		view,
		solo,
		todayTick,
	} = args;
	// The agenda lists days that have lessons, in week order; today joins the
	// list even when it is empty, so "Сьогодні" always has somewhere to land.
	// Outside a dated week the semester still knows whether today is a teaching
	// day, so the agenda opens on today whenever inside the semester.
	const now = new Date();
	const todayDay =
		semester === undefined
			? undefined
			: (todayColumn ??
				(currentWeekOf(semester.weekDates, now) === undefined
					? undefined
					: weekdayOf(localIsoDate(now))));
	const agendaDays = DAYS.filter(
		(day) => day === todayDay || dated.some((event) => event.row.day === day),
	);
	// The agenda selection belongs to one (week, view, solo, semester): when any
	// of those moves, the override is stale. Reset during render, not in an
	// effect — an effect would paint the old day for a frame first.
	const resetKey = `${week ?? "all"}|${view}|${solo ?? ""}|${semester?.name ?? ""}`;
	const [resetSeen, setResetSeen] = useState(resetKey);
	const [dayOverride, setDayOverride] = useState<Day>();
	// Stepping past the week's edge opens the next week on its first day (or
	// the previous on its last): the landing is decided before the week
	// changes and applied once the new week's days are known.
	const landRef = useRef<"first" | "last">(undefined);
	if (resetSeen !== resetKey) {
		setResetSeen(resetKey);
		const landing = landRef.current;
		landRef.current = undefined;
		setDayOverride(
			landing === "first"
				? agendaDays[0]
				: landing === "last"
					? agendaDays.at(-1)
					: undefined,
		);
	}
	const day =
		(dayOverride !== undefined && agendaDays.includes(dayOverride)
			? dayOverride
			: undefined) ??
		(todayDay !== undefined && agendaDays.includes(todayDay)
			? todayDay
			: undefined) ??
		agendaDays[0];

	const agendaRef = useRef<HTMLDivElement | null>(null);
	const sectionsRef = useRef(new Map<Day, HTMLElement>());
	const scrollingRef = useRef(false);
	const registerSection = (sectionDay: Day) => (node: HTMLElement | null) => {
		if (node) sectionsRef.current.set(sectionDay, node);
		else sectionsRef.current.delete(sectionDay);
	};
	const scrollToDay = (
		next: Day,
		// An explicit "smooth" overrides the reduced-motion CSS rule, so ask here.
		behavior: ScrollBehavior = matchMedia("(prefers-reduced-motion: reduce)")
			.matches
			? "auto"
			: "smooth",
	) => {
		setDayOverride(next);
		const section = sectionsRef.current.get(next);
		// A commanded scroll fires scroll events on the way; they must not
		// override the day the dock just picked. The day is already set, so
		// the flag only needs to outlive the smooth scroll itself.
		scrollingRef.current = true;
		section?.scrollIntoView({ block: "start", behavior });
		setTimeout(() => {
			scrollingRef.current = false;
		}, 500);
	};
	// The arrows cross weeks and land on the edge day; at the semester's
	// ends there is nowhere to go.
	const edgeWeek = (delta: 1 | -1): Week | undefined => {
		if (day === undefined || week === undefined) return undefined;
		const index = agendaDays.indexOf(day);
		const atEdge = delta === 1 ? index === agendaDays.length - 1 : index === 0;
		return atEdge ? stepWeek(weeks, week, delta) : undefined;
	};
	const stepWeekTo = (delta: 1 | -1) => {
		const next = edgeWeek(delta);
		if (next === undefined) return;
		landRef.current = delta === 1 ? "first" : "last";
		setWeek(next);
	};

	const onAgendaScroll = () => {
		const agenda = agendaRef.current;
		if (!agenda || scrollingRef.current) return;
		const agendaTop = agenda.getBoundingClientRect().top;
		let current: Day | undefined;
		for (const sectionDay of agendaDays) {
			const section = sectionsRef.current.get(sectionDay);
			if (!section) continue;
			if (section.getBoundingClientRect().top - agendaTop <= 48)
				current = sectionDay;
			else break;
		}
		if (current !== undefined && current !== day) setDayOverride(current);
	};
	// A week or view switch remakes the sections; land on the selected day
	// once they are laid out. The key also covers hydration: the sections
	// only gain days once the plan loads.
	const contextKey = `${week ?? "all"}|${view}|${solo ?? ""}|${semester?.name}|${agendaDays.length}`;
	const syncedKeyRef = useRef<string | undefined>(undefined);
	useEffect(() => {
		if (syncedKeyRef.current === contextKey) return;
		syncedKeyRef.current = contextKey;
		if (day !== undefined) {
			const frame = requestAnimationFrame(() =>
				sectionsRef.current
					.get(day)
					?.scrollIntoView({ block: "start", behavior: "auto" }),
			);
			return () => cancelAnimationFrame(frame);
		}
	}, [contextKey, day]);

	const tickSeenRef = useRef(todayTick);
	useEffect(() => {
		if (tickSeenRef.current === todayTick) return;
		tickSeenRef.current = todayTick;
		if (todayDay === undefined) return;
		const frame = requestAnimationFrame(() => scrollToDay(todayDay));
		return () => cancelAnimationFrame(frame);
	}, [todayTick, todayDay, scrollToDay]);

	return {
		day,
		todayDay,
		agendaDays,
		agendaRef,
		registerSection,
		onAgendaScroll,
		scrollToDay,
		stepWeekTo,
		edgePrev: edgeWeek(-1),
		edgeNext: edgeWeek(1),
	};
};
function PhoneLessonRow(props: {
	event: CalendarEvent;
	partners: ReadonlyArray<CalendarEvent>;
	dimmed: boolean;
	muted: boolean;
	names: ReadonlyMap<string, string>;
	semester: Semester;
	singleWeek: boolean;
	offerings: ReadonlyArray<Offering>;
	onChoose: Props["onChoose"];
	onInfo: () => void;
	readOnly: boolean;
	inp: InpResolution | undefined;
	onSwitchStream: (from: DisciplineId, to: DisciplineId) => void;
}) {
	const {
		event,
		partners,
		dimmed,
		muted,
		names,
		semester,
		singleWeek,
		onChoose,
		onInfo,
		inp,
		onSwitchStream,
	} = props;
	const { readOnly } = props;
	const clash = partners.length > 0;
	const { row, offering, group, status } = event;
	const main = displayShort(names, row.disciplineId, row.discipline);
	const provenance = provenanceOf(offering, semester, inp);
	const struck = status === "infeasible" || status === "full";
	const meta = eventMeta(event, semester, singleWeek);
	const changed = useChangeMarks().byLesson;
	const change =
		status === "lecture" || status === "chosen"
			? changed.get(lessonKey(row))
			: undefined;

	const style = `${cardStyle(status, { alternative: muted, clash, dimmed })} ${change ? CHANGED_STYLE : ""}`;
	const text = (
		<>
			<LessonText
				main={main}
				meta={meta}
				edited={editedNoteOf(row)}
				status={status}
				clash={clash}
				readOnly={readOnly}
			/>
			{change && <ChangePill change={change} inverse={status === "chosen"} />}
		</>
	);
	// The sheet pill can open the stream menu, so it sits beside the choose
	// button, never inside it: a button in a button swallows taps.
	const badge = (
		<SheetBadge
			provenance={provenance}
			disciplineId={offering.disciplineId}
			semester={semester}
			onSwitch={
				readOnly ? undefined : (to) => onSwitchStream(offering.disciplineId, to)
			}
			tone={status === "chosen" ? "inverse" : "default"}
			className="mt-1"
		/>
	);

	const info = (
		<LessonInfoButton
			main={main}
			disciplineId={offering.disciplineId}
			group={group}
			status={status}
			onInfo={onInfo}
		/>
	);

	if (group === undefined) {
		return (
			<div
				data-clash={clash || undefined}
				className={`isolate mb-1.5 flex min-h-11 items-center gap-1 rounded-lg border px-2.5 py-2 ${style}`}
			>
				<div className="min-w-0 flex-1">
					{text}
					{badge}
				</div>
				{info}
			</div>
		);
	}

	// The card is the hit area: the choose button stretches over it (its
	// ::after); a stream menu pill and the info button sit above that layer,
	// and `isolate` keeps them under the sticky day title.
	return (
		<div
			className={`relative isolate mb-1.5 flex items-center gap-1 rounded-lg border px-2.5 py-2 has-focus-visible:ring-2 has-focus-visible:ring-ring ${style}`}
		>
			<div className="min-w-0 flex-1">
				{/* oxlint-disable-next-line ui/no-raw-controls -- a lesson chip is the grid's own control: multi-line, full-cell, its own states */}
				<button
					type="button"
					onClick={() => {
						if (!readOnly) onChoose(offering.disciplineId, group);
					}}
					aria-pressed={status === "chosen"}
					aria-disabled={readOnly || undefined}
					data-testid={`group-${offering.disciplineId}-${group}`}
					data-infeasible={struck || undefined}
					data-clash={clash || undefined}
					className="block min-h-9 w-full text-left outline-none after:absolute after:inset-0 after:rounded-lg"
				>
					{text}
				</button>
				{badge}
			</div>
			{info}
		</div>
	);
}

function LessonText(props: {
	main: string;
	meta: string;
	/** What the student changed in this lesson, when they did. */
	edited: string | undefined;
	status: EventStatus;
	clash: boolean;
	readOnly: boolean;
}) {
	const { main, meta, edited, status, clash, readOnly } = props;
	return (
		<span className="block min-w-0">
			<span className="block break-words text-sm leading-snug font-medium">
				{main}
			</span>
			<span
				className={`mt-0.5 flex items-center gap-x-1 text-xs ${metaTone(status)}`}
			>
				{status === "chosen" && !readOnly && (
					<Check className="size-3.5 shrink-0" aria-label="обрано" />
				)}
				<span>{meta}</span>
				{clash && <span className={clashTone(status)}>накладка</span>}
			</span>
			{edited && (
				<span
					className={`block text-xs italic ${metaTone(status)}`}
					data-testid="edited-note"
				>
					{edited}
				</span>
			)}
		</span>
	);
}

function LessonInfoButton(props: {
	main: string;
	disciplineId: DisciplineId;
	group: GroupLabel | undefined;
	status: EventStatus;
	onInfo: () => void;
}) {
	const { main, disciplineId, group, status, onInfo } = props;
	return (
		// oxlint-disable-next-line ui/no-raw-controls -- a lesson chip is the grid's own control: multi-line, full-cell, its own states
		<button
			type="button"
			onClick={(click) => {
				click.stopPropagation();
				onInfo();
			}}
			aria-label={`Деталі: ${main}`}
			data-testid={`lesson-info-${disciplineId}-${group ?? "lecture"}`}
			className={`relative z-10 flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${status === "chosen" ? "text-primary-foreground/80" : "text-muted-foreground"}`}
		>
			<Info className="size-4" />
		</button>
	);
}

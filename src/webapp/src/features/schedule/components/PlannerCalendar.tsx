import type {
	Day,
	DisciplineId,
	GroupLabel,
	InpResolution,
	LessonRow,
	Offering,
} from "@/features/schedule/core";
import { dateOfDayInWeek, lessonKey } from "@/features/schedule/core";
import { CalendarClock, Check, Ellipsis, EyeOff, Focus } from "lucide-react";
import type { CSSProperties, Ref } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
	ChangeGhostCard,
	ChangePill,
	CHANGED_STYLE,
} from "@/features/schedule/components/ChangeMarks";
import { SheetBadge } from "@/features/schedule/components/SheetBadge";
import {
	provenanceHint,
	provenanceOf,
} from "@/features/schedule/lib/provenance";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { usePlanDraft } from "@/features/schedule/stores/plan";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/Tooltip";
import { EmptyPlan, NoClashes } from "@/features/schedule/components/EmptyPlan";
import { PhoneDayView } from "@/features/schedule/components/PhoneDayView";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { useCalendarModel } from "@/features/schedule/hooks/useCalendarModel";
import { useChangeMarks } from "@/features/schedule/hooks/useLessonChanges";
import type { Timetable } from "@/features/schedule/lib/plan-view";
import type { Semester } from "@/features/schedule/lib/data";
import {
	ALTERNATIVE_STYLE,
	EVENT_STYLE,
	cardStyle,
	clashTone,
	editedNoteOf,
	eventHint,
	eventMetaParts,
	layoutDay,
	metaTone,
	type CalendarEvent,
	type DayLayout,
	type RowSpan,
} from "@/features/schedule/lib/calendar-events";
import { shortDate } from "@/features/schedule/lib/format";
import {
	ghostsIn,
	type ChangeGhost,
} from "@/features/schedule/lib/lesson-changes";
import { displayShort } from "@/features/schedule/lib/names";
import { cn } from "@/lib/utils";
import { useUi } from "@/features/schedule/stores/ui";

interface Props {
	planner: Timetable;
	onChoose: (disciplineId: DisciplineId, group: GroupLabel) => void;
	/** The plan is locked: cells show, but a click changes nothing. */
	readOnly?: boolean;
	/** The grid element, for the PNG export to rasterise what is on screen. */
	gridRef?: Ref<HTMLTableElement>;
	/** The phone agenda: the same export on a phone rasterises the shown week. */
	phoneRef?: React.RefObject<HTMLDivElement | null>;
	/** Empty plan CTA: open the discipline catalog. */
	onBrowse?: () => void;
	/** Open the lesson editor. Absent on a shared page; present on a locked
	 *  plan too, because teachers move lessons after the plan is final. */
	onEdit?: (row: LessonRow, name: string) => void;
}

/**
 * The whole app in one grid: every lecture and every candidate group of the
 * picked disciplines, placed by time. Clicking a group selects it; conflicted
 * groups are struck through but stay clickable. Below the md breakpoint the
 * same model renders as a scrolling week agenda instead.
 */
export function PlannerCalendar(props: Props) {
	const {
		planner,
		onChoose,
		readOnly = false,
		gridRef,
		phoneRef,
		onBrowse,
		onEdit,
	} = props;
	const {
		pickedOfferings: offerings,
		effective: selection,
		displayNames: names,
		lessons: { labels },
	} = planner;
	const semester = planner.semester;
	const { focus, week, view, solo, setSolo, todayTick } = useUi();
	const isMobile = useIsMobile();
	const scrollerRef = useRef<HTMLDivElement>(null);

	const model = useCalendarModel(planner);
	const marks = useChangeMarks();
	const { clashing, days, slots, visible, todayColumn, nowMark, span } = model;

	// Escape leaves solo mode.
	useEffect(() => {
		if (solo === undefined) return;
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") setSolo(undefined);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [solo, setSolo]);

	// A dated week opens scrolled to today, not to Monday.
	useEffect(() => {
		if (week === undefined || todayColumn === undefined) return;
		scrollerRef.current
			?.querySelector('[data-testid="today"]')
			?.scrollIntoView({ inline: "center", block: "nearest" });
	}, [week, todayColumn, todayTick]);
	// «Сьогодні» also brings the day back from its first pair.
	useEffect(() => {
		if (todayTick > 0) scrollerRef.current?.scrollTo({ top: 0 });
	}, [todayTick]);

	if (isMobile) {
		return (
			<PhoneDayView
				planner={planner}
				onChoose={onChoose}
				readOnly={readOnly}
				phoneRef={phoneRef}
				onBrowse={onBrowse}
				onEdit={onEdit}
			/>
		);
	}

	if (!semester || offerings.length === 0) {
		return <EmptyPlan onBrowse={onBrowse} />;
	}

	if (visible.length === 0 && week !== undefined && view !== "clashes") {
		return (
			<div className="h-full overflow-auto">
				<table
					className="w-full table-fixed border-collapse"
					data-testid="planner-calendar"
				>
					<thead>
						<tr>
							<th className="w-22 border-b border-border/60 p-2">
								<span className="sr-only">Пара</span>
							</th>
							{days.length === 0 ? (
								<th className="border-b border-border/60 px-2.5 py-2 text-left text-xs font-medium text-muted-foreground">
									Цього тижня твоїх пар немає.
								</th>
							) : (
								days.map((day) => (
									<th
										key={day}
										className="border-b border-l border-border/60 px-2.5 py-2 text-left text-xs font-medium text-foreground"
									>
										{day}
									</th>
								))
							)}
						</tr>
					</thead>
					<tbody>
						<tr>
							<td
								colSpan={Math.max(1, days.length) + 1}
								className="px-6 py-10 text-center text-xs text-muted-foreground"
							>
								На {week}-му тижні обраних дисциплін немає. Глянь інший тиждень
								або весь семестр.
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		);
	}

	// One pass over the visible events: every grid cell below reads its own
	// bucket, instead of each cell scanning the whole list again. A lesson the
	// sheet prints off the bell grid is laid out per day instead, over every
	// row its clock covers.
	const byDaySlot = new Map<string, CalendarEvent[]>();
	const offGrid = new Map<Day, CalendarEvent[]>();
	for (const event of visible) {
		if (event.row.time !== undefined) {
			offGrid.set(event.row.day, [
				...(offGrid.get(event.row.day) ?? []),
				event,
			]);
			continue;
		}
		const cell = `${event.row.day}|${event.row.slot}`;
		const bucket = byDaySlot.get(cell);
		if (bucket) bucket.push(event);
		else byDaySlot.set(cell, [event]);
	}
	const layouts = new Map<Day, DayLayout>();
	for (const [day, events] of offGrid) {
		const bellRows = new Set(
			slots.flatMap((slot, index) =>
				byDaySlot.has(`${day}|${slot}`) ? [index] : [],
			),
		);
		layouts.set(day, layoutDay(events, bellRows));
	}
	const ghosts = new Map<string, ChangeGhost[]>();
	for (const ghost of ghostsIn(marks.ghosts, week)) {
		if (solo !== undefined && ghost.row.disciplineId !== solo) continue;
		const cell = `${ghost.row.day}|${ghost.row.slot}`;
		ghosts.set(cell, [...(ghosts.get(cell) ?? []), ghost]);
	}

	return (
		<div className="h-full overflow-auto" ref={scrollerRef}>
			{view === "clashes" && clashing.size === 0 && <NoClashes />}
			<table
				ref={gridRef}
				className="w-full min-w-2xl table-fixed border-collapse"
				data-testid="planner-calendar"
				aria-label="Розклад за парами і днями"
			>
				<thead>
					<tr>
						<th className="sticky top-0 left-0 z-30 w-22 border-b border-border/60 bg-card p-2.5">
							<span className="sr-only">Пара</span>
						</th>
						{days.map((day) => {
							const date = span
								? dateOfDayInWeek(span.start, span.end, day)
								: undefined;
							const absent = span !== undefined && date === undefined;
							const isToday = day === todayColumn;
							return (
								<th
									key={day}
									data-testid={isToday ? "today" : undefined}
									// Opaque, so the lessons scrolling under the sticky header stay hidden.
									className={[
										"sticky top-0 z-20 border-b border-border/60 px-3 py-2.5 text-left text-xs font-semibold",
										absent ? "text-muted-foreground/40" : "text-foreground",
										isToday
											? "border-b-2 border-b-primary bg-[color-mix(in_srgb,var(--color-primary)_5%,var(--color-card))] text-primary"
											: "bg-card",
									].join(" ")}
								>
									{day}
									{date && (
										<span className="ml-1.5 font-mono text-meta font-normal text-muted-foreground">
											{shortDate(date)}
										</span>
									)}
								</th>
							);
						})}
					</tr>
				</thead>
				<tbody>
					{slots.map((slot, index) => {
						const [start, end] = slot.split("-");
						return (
							<tr key={slot}>
								<th
									scope="row"
									className="sticky left-0 z-10 border-b border-border/30 bg-card px-2 py-2.5 text-left align-top font-normal"
								>
									<div className="text-xs font-semibold text-foreground">
										{index + 1} пара
									</div>
									<div className="font-mono text-mini whitespace-nowrap text-muted-foreground tabular-nums">
										{start}–{end}
									</div>
								</th>
								{days.map((day) => {
									const mark =
										day === todayColumn && nowMark?.slot === slot
											? nowMark
											: undefined;
									const layout = layouts.get(day);
									const segments =
										layout?.placed.filter(
											({ span }) => span.first <= index && index <= span.last,
										) ?? [];
									const columns =
										layout === undefined
											? 1
											: layout.lanes + (layout.shared ? 1 : 0);
									const viewProps = (event: CalendarEvent) => ({
										event,
										partners: clashing.get(event) ?? [],
										dimmed:
											focus !== undefined &&
											event.offering.disciplineId !== focus,
										muted:
											event.group !== undefined &&
											event.status !== "chosen" &&
											selection[event.offering.disciplineId] !== undefined,
										offerings: planner.lessons.offerings,
										semester,
										names,
										labels,
										singleWeek: week !== undefined,
										onChoose,
										readOnly,
										onEdit,
										inp: planner.inp,
										onSwitchStream: planner.switchStream,
									});
									return (
										<td
											key={day}
											className={[
												"relative border-b border-border/30 p-2 align-top odd:bg-muted/20",
												day === todayColumn ? "bg-primary/5" : "",
											].join(" ")}
										>
											{mark && (
												<div
													data-testid="now-line"
													aria-hidden="true"
													className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
													style={{ top: `${mark.fraction * 100}%` }}
												>
													<span className="-ml-1 size-2 shrink-0 rounded-full bg-primary" />
													<span className="h-0.5 flex-1 bg-primary" />
												</div>
											)}
											{segments.map(
												({ event, span, lane, textRow }, segmentIndex) => {
													const placement = segmentOf(
														span,
														index,
														lane,
														columns,
													);
													return textRow === index ? (
														<CalendarEventView
															key={segmentIndex}
															{...viewProps(event)}
															placement={placement}
														/>
													) : (
														<CardContinuation
															key={segmentIndex}
															{...viewProps(event)}
															placement={placement}
														/>
													);
												},
											)}
											<div
												className={
													layout?.covered.has(index) && !layout.shared
														? "relative z-7 ml-5 rounded-lg bg-background"
														: undefined
												}
												style={{
													marginLeft:
														layout?.shared && layout.covered.has(index)
															? `${(layout.lanes / columns) * 100}%`
															: undefined,
												}}
											>
												{(byDaySlot.get(`${day}|${slot}`) ?? []).map(
													(event, eventIndex) => (
														<CalendarEventView
															key={eventIndex}
															{...viewProps(event)}
														/>
													),
												)}
												{(ghosts.get(`${day}|${slot}`) ?? []).map(
													(ghost, ghostIndex) => (
														<ChangeGhostCard
															key={ghostIndex}
															ghost={ghost}
															names={names}
															labels={labels}
														/>
													),
												)}
											</div>
										</td>
									);
								})}
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}

/** One row's part of an off-grid card: where it sits in the cell and which
 *  of its edges are the card's own (the others join the next row's part). */
interface Placement {
	readonly style: CSSProperties;
	readonly edges: string;
	/** How much of its row this part runs, 0 to 1: the row grows until the
	 *  card's text fits in that much. */
	readonly share: number;
}

const segmentOf = (
	span: RowSpan,
	index: number,
	lane: number,
	columns: number,
): Placement => {
	const opens = index === span.first;
	const closes = index === span.last;
	// Percentages are of the cell, so the card follows its clock whatever
	// height the row grows to. A joined edge bleeds over the cell border.
	const gap = columns > 1 ? "0.25rem" : "0px";
	return {
		style: {
			top: opens ? `${span.top * 100}%` : "-1px",
			bottom: closes ? `${(1 - span.bottom) * 100}%` : "-1px",
			left: `calc(0.5rem + (100% - 1rem) * ${lane / columns})`,
			width: `calc((100% - 1rem) / ${columns} - ${gap})`,
			// The ring and the shadow stop at a joined edge, so the parts read as one card.
			clipPath: `inset(${opens ? "-8px" : "0"} -8px ${closes ? "-8px" : "0"} -8px)`,
		},
		edges: [
			opens ? "rounded-t-lg" : "rounded-t-none border-t-0",
			closes ? "rounded-b-lg" : "rounded-b-none border-b-0",
		].join(" "),
		share: (closes ? span.bottom : 1) - (opens ? span.top : 0),
	};
};

/**
 * An off-grid card sits at a share of its row, and an absolutely placed
 * card gives the row no height: measure the card's own content and float a
 * zero-width strut into the cell, so the row grows until the text fits in
 * that share. Undefined parts for a card in the flow.
 */
const useFitHeight = (placement: Placement | undefined) => {
	const cardRef = useRef<HTMLDivElement>(null);
	const [natural, setNatural] = useState<number>();
	const placed = placement !== undefined;
	useLayoutEffect(() => {
		const card = cardRef.current;
		if (!placed || !card) return;
		const measure = () => {
			const { paddingBottom, borderBottomWidth } = getComputedStyle(card);
			const bottom = Math.max(
				0,
				...[...card.children].map((child) =>
					child instanceof HTMLElement
						? child.offsetTop + child.offsetHeight
						: 0,
				),
			);
			setNatural(
				bottom + parseFloat(paddingBottom) + parseFloat(borderBottomWidth),
			);
		};
		measure();
		const observer = new ResizeObserver(measure);
		for (const child of card.children) observer.observe(child);
		return () => observer.disconnect();
	}, [placed]);
	// The card runs `share` of the cell's padding box (p-2 adds 1rem to it).
	const spacer =
		placement && natural !== undefined ? (
			<div
				aria-hidden="true"
				className="float-left w-0"
				style={{ height: `calc(${natural / placement.share}px - 1rem)` }}
			/>
		) : undefined;
	return { cardRef, spacer };
};

/** The rows of an off-grid card below or above its text: the same colours,
 *  and a click on them chooses the group like the card does. */
function CardContinuation(props: {
	event: CalendarEvent;
	partners: ReadonlyArray<CalendarEvent>;
	dimmed: boolean;
	muted: boolean;
	onChoose: Props["onChoose"];
	readOnly: boolean;
	placement: Placement;
}) {
	const { event, partners, dimmed, muted, onChoose, readOnly, placement } =
		props;
	const { offering, group, status } = event;
	const changed = useChangeMarks().byLesson;
	const change =
		status === "lecture" || status === "chosen"
			? changed.get(lessonKey(event.row))
			: undefined;
	const style = `${cardStyle(status, {
		alternative: muted,
		clash: partners.length > 0,
		dimmed,
	})} ${change ? CHANGED_STYLE : ""}`;
	return (
		<div
			aria-hidden="true"
			data-testid={`continued-${offering.disciplineId}-${group ?? "lecture"}`}
			onClick={() => {
				if (group !== undefined && !readOnly)
					onChoose(offering.disciplineId, group);
			}}
			className={`absolute z-5 rounded-lg border transition-opacity ${placement.edges} ${style} ${group !== undefined && !readOnly ? "cursor-pointer" : ""}`}
			style={placement.style}
		/>
	);
}

function CalendarEventView(props: {
	event: CalendarEvent;
	partners: ReadonlyArray<CalendarEvent>;
	dimmed: boolean;
	/** Another group of this discipline is already chosen: fade, keep clickable. */
	muted: boolean;
	offerings: ReadonlyArray<Offering>;
	semester: Semester;
	names: ReadonlyMap<string, string>;
	/** What the engine calls each discipline: the abbreviation when the student asked. */
	labels: ReadonlyMap<string, string>;
	singleWeek: boolean;
	onChoose: Props["onChoose"];
	readOnly: boolean;
	onEdit: ((row: LessonRow, name: string) => void) | undefined;
	onSwitchStream: (from: DisciplineId, to: DisciplineId) => void;
	inp: InpResolution | undefined;
	/** Set on an off-grid card: drawn over its rows at its own clock. */
	placement?: Placement;
}) {
	const {
		placement,
		event,
		partners,
		dimmed,
		muted,
		offerings,
		semester,
		names,
		labels,
		singleWeek,
		onChoose,
		readOnly,
		onEdit,
		onSwitchStream,
		inp,
	} = props;
	const { row, offering, group, status } = event;
	const { solo, setSolo } = useUi();
	const toggleHidden = usePlanDraft((state) => state.toggleHidden);
	const fullName = displayShort(names, row.disciplineId, row.discipline);
	const name = labels.get(row.disciplineId) ?? fullName;
	const struck = status === "infeasible" || status === "full";
	const clash = partners.length > 0;
	const changed = useChangeMarks().byLesson;
	const change =
		status === "lecture" || status === "chosen"
			? changed.get(lessonKey(row))
			: undefined;

	const meta = eventMetaParts(event, semester, singleWeek);
	const provenance = provenanceOf(offering, semester, inp);
	// The chip names the sheet like the tooltip does: every lesson carries
	// its stream, no quiet default left to explain.
	const hint = [
		eventHint(event, {
			offerings,
			semester,
			singleWeek,
			names,
			partners,
			readOnly,
		}),
		provenanceHint(provenance, { settled: readOnly }),
	]
		.filter(Boolean)
		.join("\n");

	const editedNote = editedNoteOf(row);
	const text = (
		<>
			<span
				className="block pr-4 text-xs leading-snug font-medium pointer-coarse:pr-8"
				title={name === fullName ? undefined : fullName}
			>
				{name}
			</span>
			<span
				className={`mt-0.5 flex flex-wrap items-center gap-x-1 text-meta ${metaTone(status)}`}
			>
				{/* Short parts («гр. 3», «тижні 2–12») never break inside; a long
            room list may. */}
				{meta.map((part, index) => (
					<span
						key={index}
						className={`inline-flex items-center gap-x-1 ${part.length <= 16 ? "whitespace-nowrap" : ""}`}
					>
						{index === 0 && status === "chosen" && !readOnly && (
							<Check className="size-3 shrink-0" aria-label="обрано" />
						)}
						{part}
						{index < meta.length - 1 && ", "}
					</span>
				))}
				{editedNote && (
					<span className="block w-full italic" data-testid="edited-note">
						{editedNote}
					</span>
				)}
				{clash && <span className={clashTone(status)}>накладка</span>}
			</span>
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

	const style = `${cardStyle(status, { alternative: muted, clash, dimmed })} ${change ? CHANGED_STYLE : ""}`;
	const fit = useFitHeight(placement);
	// An off-grid card is drawn over its rows; it grows past its clock rather
	// than clip its own text.
	const wrapper = placement
		? "group/cell absolute z-6 isolate flex min-h-fit flex-col"
		: "group/cell relative isolate";
	const edges = placement ? `flex-1 ${placement.edges}` : "mb-1.5 rounded-lg";
	// Every way to act on this lesson, behind one «⋯» in the corner. Editing
	// is for lessons the student attends (a lecture, the chosen group); the
	// alternatives are the sheet's business. A locked plan keeps only that.
	const active = status === "lecture" || status === "chosen";
	const editable = active && onEdit !== undefined;
	const menu = (!readOnly || editable) && (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="icon-xs"
					onClick={(click) => click.stopPropagation()}
					aria-label={`Дії: ${fullName}`}
					data-testid={`cell-menu-${offering.disciplineId}-${group ?? "lecture"}`}
					className={`absolute top-1 right-1 z-20 rounded-full opacity-0 group-hover/cell:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 pointer-coarse:size-8 pointer-coarse:min-h-8 pointer-coarse:opacity-80 ${
						status === "chosen"
							? "text-primary-foreground/80 hover:bg-white/15 hover:text-primary-foreground"
							: "text-muted-foreground"
					}`}
				>
					<Ellipsis className="size-3 pointer-coarse:size-4" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-60">
				{group !== undefined && !readOnly && (
					<DropdownMenuItem
						onSelect={() => onChoose(offering.disciplineId, group)}
					>
						<Check />{" "}
						{status === "chosen" ? "Зняти вибір" : `Обрати гр. ${group}`}
					</DropdownMenuItem>
				)}
				{editable && (
					<DropdownMenuItem
						data-testid={`edit-${offering.disciplineId}-${group ?? "lecture"}`}
						onSelect={() => onEdit(row, fullName)}
					>
						<CalendarClock /> Змінити пару
					</DropdownMenuItem>
				)}
				{!readOnly && (
					<>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							onSelect={() =>
								setSolo(
									solo === offering.disciplineId
										? undefined
										: offering.disciplineId,
								)
							}
						>
							<Focus />{" "}
							{solo === offering.disciplineId
								? "Показати всі дисципліни"
								: "Лише ця дисципліна"}
						</DropdownMenuItem>
						<DropdownMenuItem
							onSelect={() => toggleHidden(offering.disciplineId)}
						>
							<EyeOff /> Сховати дисципліну
						</DropdownMenuItem>
					</>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);

	// The tooltip belongs to the lesson, the «⋯» sits beside it: an open menu
	// never has the lesson's tooltip hanging over it.
	if (group === undefined) {
		return (
			<>
				<div className={wrapper} style={placement?.style}>
					<Tooltip>
						<TooltipTrigger asChild>
							{/* Focusable, so a keyboard reaches the hint (clash partners, sheet). */}
							<div
								ref={fit.cardRef}
								tabIndex={0}
								data-clash={clash || undefined}
								className={`${edges} border px-2.5 py-2 transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-ring ${style}`}
							>
								{text}
								{badge}
							</div>
						</TooltipTrigger>
						<TooltipContent className="whitespace-pre-line">
							{hint}
						</TooltipContent>
					</Tooltip>
					{menu}
				</div>
				{fit.spacer}
			</>
		);
	}

	// The card is the hit area: the choose button stretches over it (its
	// ::after), and a stream menu pill and the «⋯» sit above that layer.
	// `isolate` keeps those layers under the sticky day header.
	return (
		<>
			<div className={wrapper} style={placement?.style}>
				<div
					ref={fit.cardRef}
					className={`relative ${edges} border px-2.5 py-2 transition-[border-color,background-color,box-shadow,opacity] has-focus-visible:ring-2 has-focus-visible:ring-ring ${style}`}
				>
					<Tooltip>
						<TooltipTrigger asChild>
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
								className={`block w-full text-left outline-none after:absolute after:inset-0 after:rounded-lg ${readOnly ? "cursor-default" : "cursor-pointer"}`}
							>
								{text}
							</button>
						</TooltipTrigger>
						<TooltipContent className="whitespace-pre-line">
							{hint}
						</TooltipContent>
					</Tooltip>
					{badge}
				</div>
				{menu}
			</div>
			{fit.spacer}
		</>
	);
}

/** What each colour on the grid means. Red is only ever a clash. */
const LEGEND_ITEMS = [
	{ style: EVENT_STYLE.lecture, label: "Лекція" },
	{ style: EVENT_STYLE.open, label: "Можна обрати" },
	{ style: EVENT_STYLE.chosen, label: "Обрано" },
	{ style: ALTERNATIVE_STYLE, label: "Інша група: можна перемкнути" },
	// The cell has no border; the swatch needs one to be seen at all.
	{
		style: `${EVENT_STYLE.infeasible} border-border`,
		label: "Не поєднується з планом",
	},
	{
		style: "border-destructive/60 bg-card",
		label: "Накладка: дві пари одночасно",
	},
] as const;

export function CalendarLegend() {
	return (
		<ul className="flex flex-col gap-1.5 text-xs text-muted-foreground">
			{LEGEND_ITEMS.map((item) => (
				<li key={item.label} className="flex items-center gap-2">
					<span
						className={cn(
							"inline-block size-3 shrink-0 rounded-xs border",
							item.style,
						)}
					/>
					{item.label}
				</li>
			))}
		</ul>
	);
}

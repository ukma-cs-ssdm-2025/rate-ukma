import { Check } from "lucide-react";

type Tone = "lecture" | "chosen" | "alternative" | "clash";

interface Cell {
	readonly day: number;
	readonly slot: number;
	readonly title: string;
	readonly group: string;
	readonly tone: Tone;
}

const DAYS = ["Пн", "Вт", "Ср", "Чт", "Пт"];
const SLOTS = ["8:30", "10:00", "11:40", "13:30"];

/** A made-up week, laid out the way the planner draws a real one. */
const CELLS: ReadonlyArray<Cell> = [
	{ day: 0, slot: 0, title: "Матаналіз", group: "лекція", tone: "lecture" },
	{ day: 1, slot: 1, title: "Алгоритми", group: "гр. 2", tone: "chosen" },
	{ day: 1, slot: 2, title: "Алгоритми", group: "гр. 3", tone: "alternative" },
	{ day: 2, slot: 0, title: "Англійська", group: "А12", tone: "chosen" },
	{ day: 2, slot: 1, title: "Історія", group: "лекція", tone: "lecture" },
	{ day: 3, slot: 1, title: "Дискретна", group: "гр. 1", tone: "chosen" },
	{ day: 3, slot: 1, title: "Матаналіз", group: "гр. 4", tone: "clash" },
	{ day: 4, slot: 2, title: "Алгоритми", group: "гр. 1", tone: "alternative" },
	{ day: 4, slot: 3, title: "Англійська", group: "А14", tone: "alternative" },
];

const TONE = {
	lecture: "border-l-2 border-primary/40 bg-primary/8 text-foreground",
	chosen: "bg-primary text-primary-foreground shadow-sm",
	alternative:
		"outline-1 -outline-offset-1 outline-dashed outline-border text-muted-foreground/70",
	clash:
		"outline-1 -outline-offset-1 outline-destructive/60 bg-destructive/8 text-foreground",
} satisfies Record<Tone, string>;

/** The planner's own week grid, small and static: what signing in leads to. */
export function ScheduleSketch() {
	return (
		<div
			aria-hidden="true"
			className="w-full max-w-md rounded-xl border border-white/10 bg-card p-2 text-left sm:p-3 shadow-lg motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-700 sm:max-w-lg md:max-w-xl lg:max-w-2xl lg:rounded-2xl lg:p-4 xl:max-w-3xl 2xl:max-w-4xl"
		>
			<div className="grid grid-cols-[1.875rem_repeat(5,minmax(0,1fr))] gap-0.5 sm:grid-cols-[2.25rem_repeat(5,minmax(0,1fr))] sm:gap-1 lg:grid-cols-[3rem_repeat(5,minmax(0,1fr))] lg:gap-1.5">
				<div />
				{DAYS.map((day) => (
					<div
						key={day}
						className="pb-1 text-center tabular-nums text-mini font-medium text-muted-foreground lg:text-xs"
					>
						{day}
					</div>
				))}
				{SLOTS.map((time, slot) => (
					<div key={time} className="contents">
						<div className="pt-1 tabular-nums text-[9px] text-muted-foreground/70 sm:text-mini lg:text-xs">
							{time}
						</div>
						{DAYS.map((_, day) => (
							<div
								key={day}
								className="flex min-h-12 flex-col gap-1 rounded-md bg-muted/50 p-0.5 sm:min-h-14 lg:min-h-20 xl:min-h-24"
							>
								{CELLS.filter(
									(cell) => cell.day === day && cell.slot === slot,
								).map((cell, index) => (
									<div
										key={`${cell.title}-${cell.group}`}
										style={{
											animationDelay: `${200 + (slot * 5 + day) * 45 + index * 30}ms`,
										}}
										className={`relative flex flex-1 flex-col justify-center rounded-[5px] px-1 py-1 text-[9px] sm:px-1.5 leading-tight motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:fill-mode-both motion-safe:duration-500 sm:text-[10px] lg:rounded-md lg:px-2 lg:py-1.5 lg:text-xs xl:text-[13px] ${TONE[cell.tone]}`}
									>
										<span className="line-clamp-2 font-medium">
											{cell.title}
										</span>
										<span
											className={
												cell.tone === "chosen"
													? "opacity-80"
													: "text-muted-foreground"
											}
										>
											{cell.group}
										</span>
										{cell.tone === "clash" && (
											<span className="mt-0.5 self-start rounded-sm bg-destructive px-1 text-[7px] leading-3 font-semibold tracking-wide text-white uppercase lg:text-[9px] lg:leading-4">
												накладка
											</span>
										)}
										{cell.tone === "chosen" && (
											<Check className="absolute top-1 right-1 size-2.5 opacity-80 lg:size-3.5" />
										)}
									</div>
								))}
							</div>
						))}
					</div>
				))}
			</div>
		</div>
	);
}

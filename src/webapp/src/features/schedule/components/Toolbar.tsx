import {
	CalendarPlus,
	Check,
	ChevronLeft,
	ChevronRight,
	ClipboardCopy,
	CloudOff,
	FileDown,
	ImageDown,
	Link2,
	Loader2,
	X,
} from "lucide-react";
import {
	CALENDAR_CLIENTS,
	CALENDAR_ORDER,
	calendarAnchor,
	trackCalendarOpened,
} from "@/features/schedule/components/CalendarClients";
import { Button } from "@/components/ui/Button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { Toggle } from "@/components/ui/Toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/ToggleGroup";
import { SidebarTrigger } from "@/components/ui/Sidebar";
import {
	copyTextSilent,
	toastCopyFailed,
} from "@/features/schedule/lib/clipboard";
import { formatSpan } from "@/features/schedule/lib/format";
import { displayShort } from "@/features/schedule/lib/names";
import { stepWeek } from "@/features/schedule/lib/weeks";
import type { Exports } from "@/features/schedule/hooks/useExports";
import type { Planner } from "@/features/schedule/hooks/usePlanner";
import { useUi } from "@/features/schedule/stores/ui";
import { useEffect, useRef, useState } from "react";

/** The toolbar's segmented controls: a soft track with the active segment lifted as a card. */
export const SEGMENTED = "rounded-lg bg-muted p-0.5";
export const SEGMENT =
	"h-7 pointer-coarse:h-10 rounded-md px-2.5 text-xs text-muted-foreground hover:bg-transparent hover:text-foreground data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm";

/** A calendar bar: where the grid is on the left («Сьогодні», arrows, the
 *  week and its dates as the title), how it is cut on the right (semester
 *  or week, clashes only), and the one way out (the calendar menu). The
 *  edit/view switch is the plan's, so it lives in the rail. The phone
 *  re-flows the same nodes into a two-row grid: `max-md:contents` dissolves
 *  the two desktop groups and every control names its own cell. */
export function Toolbar({
	planner,
	exports,
}: {
	planner: Planner;
	exports: Exports;
}) {
	const {
		weeks,
		week,
		setWeek,
		span,
		thisWeek,
		solo,
		setSolo,
		displayNames,
		shownView,
		setView,
		clashCount,
		locked,
		feed,
		saveState,
		retrySave,
	} = planner;
	const { exportIcs, copyText, exportPng } = exports;
	const bumpToday = useUi((state) => state.bumpToday);
	// The menu closes on select: the trigger itself confirms success.
	const [done, setDone] = useState(false);
	const timer = useRef<number | undefined>(undefined);
	useEffect(() => () => window.clearTimeout(timer.current), []);
	const flash = () => {
		setDone(true);
		window.clearTimeout(timer.current);
		timer.current = window.setTimeout(() => setDone(false), 1600);
	};
	const flashWhen = (result: boolean | Promise<boolean> | undefined) => {
		void Promise.resolve(result ?? false).then((ok) => {
			if (ok) flash();
		});
	};
	// Inline per-row confirmation: the touched row flips to "Скопійовано" for
	// the same 1.6s window instead of a toast elsewhere on screen.
	const [copiedRow, setCopiedRow] = useState<string | undefined>(undefined);
	const copiedTimer = useRef<number | undefined>(undefined);
	useEffect(() => () => window.clearTimeout(copiedTimer.current), []);
	const flashRow = (
		id: string,
		result: boolean | Promise<boolean> | undefined,
	) => {
		void Promise.resolve(result ?? false).then((ok) => {
			if (!ok) {
				toastCopyFailed();
				return;
			}
			setCopiedRow(id);
			flash();
			window.clearTimeout(copiedTimer.current);
			copiedTimer.current = window.setTimeout(
				() => setCopiedRow(undefined),
				1600,
			);
		});
	};
	const previous = stepWeek(weeks, week, -1);
	const next = stepWeek(weeks, week, 1);
	const clashesOnly = shownView === "clashes";

	return (
		<div className="flex min-h-12 shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-border/70 bg-card px-3 py-1.5 pt-[calc(0.375rem+env(safe-area-inset-top))] max-md:grid max-md:w-full max-md:grid-cols-[5rem_1fr_5rem] max-md:gap-x-1.5 max-md:gap-y-1 max-md:px-2 max-md:py-1">
			{/* Never narrower than its controls: with the rail open on a tablet the
          cluster on the right wraps below instead of covering the week. */}
			<div className="flex min-w-fit flex-1 items-center gap-1 max-md:contents">
				<SidebarTrigger
					className="mr-1 shrink-0 text-muted-foreground max-md:col-start-1 max-md:mr-0 max-md:row-start-1 max-md:size-8 max-md:text-foreground"
					title="Дисципліни (B)"
				/>
				{thisWeek !== undefined && (
					<Button
						variant="outline"
						size="compact"
						data-testid="current-week"
						title="Тиждень, у якому ми зараз (T)"
						onClick={() => {
							setWeek(thisWeek);
							bumpToday();
						}}
						className="mr-1 shrink-0 max-md:col-start-1 max-md:mr-0 max-md:row-start-2 max-md:px-2.5 max-md:pointer-coarse:min-h-8 max-md:[&:not(:disabled)]:h-8 max-md:text-xs"
					>
						Сьогодні
					</Button>
				)}
				<nav
					aria-label="Тиждень"
					className="flex min-w-0 flex-1 items-center justify-center gap-0.5 max-md:col-start-2 max-md:row-start-1"
				>
					<Button
						variant="ghost"
						size="icon-xs"
						data-testid="week-prev"
						aria-label="Попередній тиждень"
						title="Попередній тиждень (←)"
						disabled={previous === undefined}
						onClick={() => previous !== undefined && setWeek(previous)}
						className="shrink-0 text-muted-foreground max-md:justify-self-start max-md:pointer-coarse:size-8"
					>
						<ChevronLeft />
					</Button>
					<h1
						className="min-w-0 shrink truncate px-1 text-center text-sm font-semibold text-foreground"
						title={span ? formatSpan(span.start, span.end) : undefined}
					>
						<span
							key={week ?? "all"}
							data-testid="week-label"
							className="animate-in duration-200 ease-out-quint fade-in-0"
						>
							{week === undefined
								? weeks.length > 0
									? `Тижні ${weeks[0]}–${weeks[weeks.length - 1]}`
									: "Без тижнів"
								: `Тиждень ${week}`}
						</span>
						{span && (
							<span
								className="ml-1.5 truncate text-xs font-normal text-muted-foreground max-md:sr-only"
								data-testid="week-dates"
							>
								{formatSpan(span.start, span.end)}
							</span>
						)}
					</h1>
					<Button
						variant="ghost"
						size="icon-xs"
						data-testid="week-next"
						aria-label="Наступний тиждень"
						title="Наступний тиждень (→)"
						disabled={next === undefined}
						onClick={() => next !== undefined && setWeek(next)}
						className="shrink-0 text-muted-foreground max-md:justify-self-end max-md:pointer-coarse:size-8"
					>
						<ChevronRight />
					</Button>
				</nav>
			</div>
			<div className="ml-auto flex flex-wrap items-center justify-end gap-2 max-md:contents md:relative">
				{/* Out of the flow on a desktop: the week title is centred against
            this cluster and would jump on every click while a save runs. */}
				{saveState === "saving" && (
					<span
						data-testid="save-state"
						role="status"
						aria-label="Зберігаємо"
						className="flex items-center gap-1 text-xs whitespace-nowrap text-muted-foreground max-md:col-start-2 max-md:justify-self-end max-md:row-start-1 md:absolute md:top-1/2 md:right-full md:mr-3 md:-translate-y-1/2"
					>
						<Loader2 className="size-3.5 animate-spin" />
						<span className="max-md:sr-only">Зберігаємо</span>
					</span>
				)}
				{saveState === "failed" && (
					<Button
						variant="destructive"
						size="xs"
						onClick={retrySave}
						data-testid="save-state"
						title="План не зберігся на сервері"
						className="max-md:col-start-1 max-md:col-end-4 max-md:justify-self-start max-md:row-start-3"
					>
						<CloudOff /> Не збережено{" "}
						<span className="max-md:hidden">— повторити</span>
					</Button>
				)}
				{solo !== undefined && (
					<Button
						variant="secondary"
						size="compact"
						onClick={() => setSolo(undefined)}
						data-testid="solo-clear"
						className="max-w-36 md:max-w-56 max-md:col-start-1 max-md:col-end-4 max-md:justify-self-start max-md:pointer-coarse:min-h-8 max-md:row-start-4"
					>
						<span className="truncate">
							Тільки: {displayShort(displayNames, solo, solo)}
						</span>
						<X />
					</Button>
				)}
				{!locked && clashCount > 0 && (
					<Toggle
						variant="outline"
						size="lg"
						pressed={clashesOnly}
						onPressedChange={(pressed) => setView(pressed ? "clashes" : "all")}
						data-testid="view-clashes"
						title={
							clashesOnly
								? "Показати всі пари знову (C)"
								: "Лишити на сітці лише пари, що накладаються (C)"
						}
						className="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive data-[state=on]:bg-destructive data-[state=on]:text-white max-md:col-start-1 max-md:col-end-4 max-md:justify-self-start max-md:pointer-coarse:min-h-8 max-md:px-2 max-md:row-start-5"
					>
						Накладки
						<span
							className={`rounded-full px-1.5 text-mini leading-4 font-semibold tabular-nums ${clashesOnly ? "bg-white/25 text-white" : "bg-destructive text-white"}`}
						>
							{clashCount}
						</span>
					</Toggle>
				)}
				<ToggleGroup
					type="single"
					value={week === undefined ? "all" : "week"}
					onValueChange={(value) => {
						if (value === "all") setWeek(undefined);
						else if (value === "week") setWeek(thisWeek ?? weeks[0]);
					}}
					aria-label="Семестр чи тиждень"
					spacing={1}
					className={`${SEGMENTED} shrink-0 max-md:col-end-4 max-md:row-start-2 max-md:w-full ${thisWeek === undefined ? "max-md:col-start-1" : "max-md:col-start-2"}`}
				>
					<ToggleGroupItem
						value="all"
						data-testid="week-all"
						title="Усі тижні на одній сітці (0 або S)"
						className={`${SEGMENT} max-md:flex-1 max-md:pointer-coarse:h-8 max-md:px-2`}
					>
						Весь семестр
					</ToggleGroupItem>
					<ToggleGroupItem
						value="week"
						data-testid="week-one"
						title="Один тиждень з датами (1 … 9)"
						className={`${SEGMENT} max-md:flex-1 max-md:pointer-coarse:h-8 max-md:px-2`}
						disabled={weeks.length === 0}
					>
						По тижнях
					</ToggleGroupItem>
				</ToggleGroup>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant="default"
							size="compact"
							data-testid="export-menu"
							aria-label="У календар"
							title="Підписка в Google, Outlook чи Apple, або разова копія"
							className="shadow-sm max-md:col-start-3 max-md:justify-self-end max-md:pointer-coarse:min-h-8 max-md:row-start-1"
						>
							{done ? <Check /> : <CalendarPlus />}
							<span className="hidden sm:inline">
								{done ? "Готово" : "У календар"}
							</span>
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="w-72">
						<DropdownMenuLabel className="font-normal text-muted-foreground">
							Підписка: зміни в розкладі підтягнуться самі.
						</DropdownMenuLabel>
						<DropdownMenuGroup>
							{CALENDAR_ORDER.map((client) => {
								const { title, hint, target, Icon } = CALENDAR_CLIENTS[client];
								return (
									<DropdownMenuItem
										key={client}
										asChild
										onSelect={() => {
											trackCalendarOpened(client);
											flash();
										}}
									>
										<a
											{...calendarAnchor(feed, client)}
											data-testid={`subscribe-${target}`}
										>
											<Icon /> {title}
											{hint && (
												<span className="ml-auto text-meta text-muted-foreground">
													{hint}
												</span>
											)}
										</a>
									</DropdownMenuItem>
								);
							})}
							<DropdownMenuItem
								onSelect={() => {
									trackCalendarOpened("link");
									flashRow("copy-feed", copyTextSilent(feed.url));
								}}
								data-testid="copy-feed"
							>
								{copiedRow === "copy-feed" ? <Check /> : <Link2 />}{" "}
								{copiedRow === "copy-feed"
									? "Скопійовано"
									: "Скопіювати посилання для іншого календаря"}
							</DropdownMenuItem>
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						<DropdownMenuLabel className="font-normal text-muted-foreground">
							Разова копія, без оновлень
						</DropdownMenuLabel>
						<DropdownMenuGroup>
							<DropdownMenuItem
								onSelect={() => {
									exportIcs();
									flash();
								}}
								data-testid="export-ics"
							>
								<FileDown /> Завантажити файл .ics
							</DropdownMenuItem>
							<DropdownMenuItem
								onSelect={() => flashWhen(exportPng())}
								data-testid="export-png"
							>
								<ImageDown /> Картинка сітки (PNG)
							</DropdownMenuItem>
							<DropdownMenuItem
								onSelect={() => flashRow("copy-text", copyText())}
								data-testid="copy-text"
							>
								{copiedRow === "copy-text" ? <Check /> : <ClipboardCopy />}{" "}
								{copiedRow === "copy-text"
									? "Скопійовано"
									: "Скопіювати текстом"}
							</DropdownMenuItem>
						</DropdownMenuGroup>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</div>
	);
}

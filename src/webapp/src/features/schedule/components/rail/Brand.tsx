import { CalendarDays } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/Select";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/Tooltip";
import {
	absoluteTime,
	relativeTime,
	shortAgo,
} from "@/features/schedule/lib/format";
import { ScheduleMenu } from "@/features/schedule/components/rail/ScheduleMenu";
import type { Planner } from "@/features/schedule/hooks/usePlanner";

/** The rail's head: the semester the planner shows, switchable like a
 *  workspace, with the planner's settings beside it and how fresh the data
 *  is under it. Rate UKMA's header above names the page and the student. */
export function Brand({
	planner,
	onShowKeys,
}: {
	planner: Planner;
	onShowKeys: () => void;
}) {
	const { semester, semesters, isArchive, switchSemester, scheduleEmpty, me } =
		planner;
	if (!semester) return null;
	const synced = me?.plan.sazSyncedAt ?? null;

	return (
		<div className="flex flex-col gap-1">
			{/* Below 1024px the rail is a sheet, and its close button sits in this corner. */}
			<div className="flex min-h-7 items-center gap-1 max-lg:pr-7">
				<div className="min-w-0 flex-1">
					{semesters.length > 1 ? (
						<Select value={semester.name} onValueChange={switchSemester}>
							<SelectTrigger
								size="sm"
								data-testid="semester-name"
								aria-label="Семестр"
								className="-ml-1.5 h-7 w-fit max-w-full rounded-md border-0 bg-transparent px-1.5 py-0 text-sm font-semibold text-foreground shadow-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/40 dark:bg-transparent dark:hover:bg-muted"
							>
								<SelectValue>
									{semester.name}
									{isArchive && (
										<Badge
											variant="outline"
											className="ml-1.5 text-muted-foreground"
											data-testid="archive-mark"
										>
											минулий
										</Badge>
									)}
								</SelectValue>
							</SelectTrigger>
							<SelectContent align="start" className="w-60">
								<SelectGroup>
									<SelectItem value={semesters[0] ?? semester.name}>
										{semesters[0] ?? semester.name}
									</SelectItem>
								</SelectGroup>
								<SelectGroup>
									<SelectLabel>Архів</SelectLabel>
									{semesters.slice(1).map((name) => (
										<SelectItem key={name} value={name}>
											{name}
										</SelectItem>
									))}
								</SelectGroup>
							</SelectContent>
						</Select>
					) : (
						<h2
							className="truncate text-sm font-semibold text-foreground"
							data-testid="semester-name"
						>
							{semester.name}
						</h2>
					)}
				</div>
				<ScheduleMenu planner={planner} onShowKeys={onShowKeys} />
			</div>
			{/* САЗ republishes files whenever a faculty edits them, and sometimes
          not for weeks: when the sheets last changed is worth seeing on
          every device, not only under a desktop hover. */}
			<p className="flex flex-col text-xs text-muted-foreground">
				<span
					className="truncate"
					data-testid="schedule-fresh"
					title={absoluteTime(semester.ingestedAt)}
				>
					Файли розкладу оновлено {relativeTime(semester.ingestedAt)}
				</span>
				<span
					className="truncate"
					data-testid="saz-synced"
					title={synced ? absoluteTime(synced) : undefined}
				>
					{synced ? `САЗ звірено ${shortAgo(synced)}` : "САЗ ще не звірено"}
				</span>
			</p>
			{scheduleEmpty && (
				<Tooltip>
					<TooltipTrigger asChild>
						<Badge
							variant="outline"
							tabIndex={0}
							data-testid="state-badge"
							className="w-fit cursor-default gap-1 outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
						>
							<CalendarDays className="size-3" />
							Очікується розклад
						</Badge>
					</TooltipTrigger>
					<TooltipContent className="max-w-xs">
						Твій ІНП на {semester.name} збережено. Щойно з’являться файли на
						my.ukma.edu.ua, вони підтягнуться сюди.
					</TooltipContent>
				</Tooltip>
			)}
		</div>
	);
}

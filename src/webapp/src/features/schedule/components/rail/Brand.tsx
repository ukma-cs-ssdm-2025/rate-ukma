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
import { absoluteTime, relativeTime } from "@/features/schedule/lib/format";
import type { Planner } from "@/features/schedule/hooks/usePlanner";

/** The rail's head: the page's name, then the semester under it, the way a
 *  workspace switcher sits under a product name. Rate UKMA's header above
 *  carries the brand. */
export function Brand({ planner }: { planner: Planner }) {
	const { semester, semesters, isArchive, switchSemester, scheduleEmpty } =
		planner;
	if (!semester) return null;

	return (
		<div className="flex flex-col gap-2">
			{/* Below 1024px the rail is a sheet, and its close button sits in this corner. */}
			<div className="flex h-7 items-center gap-2 max-lg:pr-7">
				<h1 className="truncate text-base font-semibold text-foreground">
					Розклад
				</h1>
			</div>
			{semesters.length > 1 ? (
				<Select value={semester.name} onValueChange={switchSemester}>
					<SelectTrigger
						size="sm"
						data-testid="semester-name"
						aria-label="Семестр"
						className="-ml-1 h-6 w-fit max-w-full rounded-md border-0 bg-transparent px-1 py-0 text-xs text-muted-foreground shadow-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 dark:bg-transparent dark:hover:bg-muted"
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
				<span
					className="truncate text-xs text-muted-foreground"
					data-testid="semester-name"
				>
					{semester.name}
				</span>
			)}
			{/* САЗ republishes files whenever a faculty edits them, and sometimes
          not for weeks: when the sheets last changed is worth seeing on
          every device, not only under a desktop hover. */}
			<span
				className="-mt-1.5 truncate text-mini text-muted-foreground/80"
				data-testid="schedule-fresh"
				title={absoluteTime(semester.ingestedAt)}
			>
				Файли розкладу оновлено {relativeTime(semester.ingestedAt)}
			</span>
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

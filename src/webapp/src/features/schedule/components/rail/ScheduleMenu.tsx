import {
	CircleHelp,
	History,
	Keyboard,
	Palette,
	Settings2,
} from "lucide-react";
import { useState } from "react";
import { HowTo } from "@/features/schedule/components/HowTo";
import { CalendarLegend } from "@/features/schedule/components/PlannerCalendar";
import { ScheduleVersions } from "@/features/schedule/components/ScheduleVersions";
import { Button } from "@/components/ui/Button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/Dialog";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import type { Planner } from "@/features/schedule/hooks/usePlanner";
import { usePlanDraft } from "@/features/schedule/stores/plan";

/** Everything about the planner that is reference rather than work: the
 *  display setting, the how-to, the change history, the legend, the keys.
 *  Who is signed in and the way out live in Rate UKMA's header. */
export function ScheduleMenu({
	planner,
	onShowKeys,
}: {
	planner: Planner;
	/** The keys card lives with the key listener, outside the rail. */
	onShowKeys: () => void;
}) {
	const { semester, displayNames, pickedOfferings, effective } = planner;
	const shortNames = usePlanDraft((state) => state.shortNames);
	const setShortNames = usePlanDraft((state) => state.setShortNames);
	const [versionsOpen, setVersionsOpen] = useState(false);
	const [legendOpen, setLegendOpen] = useState(false);
	const [howtoOpen, setHowtoOpen] = useState(false);
	if (!semester) return null;

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="ghost"
						size="icon-compact"
						aria-label="Налаштування розкладу"
						title="Налаштування розкладу"
						data-testid="schedule-menu"
						className="shrink-0 text-muted-foreground"
					>
						<Settings2 />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start" className="w-64">
					<DropdownMenuCheckboxItem
						checked={shortNames}
						onCheckedChange={(checked) => setShortNames(checked === true)}
						onSelect={(event) => event.preventDefault()}
						data-testid="short-names"
					>
						Скорочувати довгі назви
					</DropdownMenuCheckboxItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem
						data-testid="howto-open"
						onSelect={() => setHowtoOpen(true)}
					>
						<CircleHelp /> Як користуватися
					</DropdownMenuItem>
					<DropdownMenuItem
						data-testid="versions"
						onSelect={() => setVersionsOpen(true)}
					>
						<History /> Що змінилося в розкладі
					</DropdownMenuItem>
					<DropdownMenuItem
						data-testid="legend-toggle"
						onSelect={() => setLegendOpen(true)}
					>
						<Palette /> Позначення на сітці
					</DropdownMenuItem>
					<DropdownMenuItem
						data-testid="hotkeys-help"
						onSelect={onShowKeys}
						className="max-md:hidden"
					>
						<Keyboard /> Клавіші
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			<ScheduleVersions
				semester={semester}
				names={displayNames}
				pickedOfferings={pickedOfferings}
				selection={effective}
				open={versionsOpen}
				onOpenChange={setVersionsOpen}
			/>
			<Dialog open={legendOpen} onOpenChange={setLegendOpen}>
				<DialogContent className="max-w-xs" data-testid="legend">
					<DialogHeader>
						<DialogTitle>Позначення на сітці</DialogTitle>
						<DialogDescription>Що означає кожен колір пари.</DialogDescription>
					</DialogHeader>
					<CalendarLegend />
				</DialogContent>
			</Dialog>
			<HowTo open={howtoOpen} onOpenChange={setHowtoOpen} />
		</>
	);
}

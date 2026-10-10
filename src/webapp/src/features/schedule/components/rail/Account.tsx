import {
	CircleHelp,
	EllipsisVertical,
	History,
	Keyboard,
	LogOut,
	Palette,
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
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import {
	absoluteTime,
	initials,
	shortAgo,
} from "@/features/schedule/lib/format";
import type { Planner } from "@/features/schedule/hooks/usePlanner";
import { usePlanDraft } from "@/features/schedule/stores/plan";

/** The rail's foot: who is signed in, when САЗ was last checked, and behind
 *  the row everything that is reference rather than work: the settings, the
 *  legend, the keys, the change history, the way out. */
export function Account({
	planner,
	onShowKeys,
}: {
	planner: Planner;
	/** The keys card lives with the key listener, outside the rail. */
	onShowKeys: () => void;
}) {
	const { semester, me, signOut, displayNames, pickedOfferings, effective } =
		planner;
	const shortNames = usePlanDraft((state) => state.shortNames);
	const setShortNames = usePlanDraft((state) => state.setShortNames);
	const [versionsOpen, setVersionsOpen] = useState(false);
	const [legendOpen, setLegendOpen] = useState(false);
	const [howtoOpen, setHowtoOpen] = useState(false);
	if (!semester || !me) return null;
	const synced = me.plan.sazSyncedAt;

	return (
		<div className="px-2 py-2">
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="ghost"
						size="xs"
						aria-label={`Акаунт і налаштування: ${me.user.name}`}
						data-testid="account-menu"
						className="h-auto w-full min-w-0 justify-start gap-2 px-1.5 py-1 text-left text-foreground"
					>
						<span
							data-testid="account"
							className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-foreground text-mini font-semibold text-background"
						>
							<Avatar name={me.user.name} photo={me.user.avatar === true} />
						</span>
						<span className="flex min-w-0 flex-1 flex-col">
							<span
								className="truncate text-xs font-medium"
								data-testid="student-name"
							>
								{me.user.name}
							</span>
							<span
								className="truncate text-mini text-muted-foreground"
								data-testid="saz-synced"
								title={synced ? absoluteTime(synced) : undefined}
							>
								{synced
									? `САЗ звірено ${shortAgo(synced)}`
									: "САЗ ще не звірено"}
							</span>
						</span>
						<EllipsisVertical className="size-3.5 shrink-0 text-muted-foreground" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start" className="w-64">
					<DropdownMenuLabel className="flex flex-col gap-0.5 font-normal">
						<span className="truncate text-sm font-medium text-foreground">
							{me.user.name}
						</span>
						<span className="truncate text-xs text-muted-foreground">
							{me.user.email}
						</span>
					</DropdownMenuLabel>
					<DropdownMenuSeparator />
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
					<DropdownMenuSeparator />
					<DropdownMenuItem data-testid="sign-out" onSelect={signOut}>
						<LogOut /> Вийти
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
		</div>
	);
}

/** The Microsoft profile photo when one was kept at sign-in; initials
 *  otherwise, and again if the photo fails to load. */
function Avatar({ name, photo }: { name: string; photo: boolean }) {
	const [broken, setBroken] = useState(false);
	if (photo && !broken) {
		return (
			<img
				src="/api/schedule/me/avatar"
				alt=""
				data-testid="avatar-photo"
				className="size-full object-cover"
				onError={() => setBroken(true)}
			/>
		);
	}
	return <>{initials(name)}</>;
}

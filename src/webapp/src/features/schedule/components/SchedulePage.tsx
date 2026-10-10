import { useState } from "react";

import type React from "react";

import Header from "@/components/Header/Header";
import { Button } from "@/components/ui/Button";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/ui/Sidebar";
import { Spinner } from "@/components/ui/Spinner";
import { TooltipProvider } from "@/components/ui/Tooltip";
import { ChangesBanner } from "@/features/schedule/components/ChangesBanner";
import { EmptySchedule } from "@/features/schedule/components/EmptySchedule";
import { Hotkeys } from "@/features/schedule/components/Hotkeys";
import {
	editOf,
	LessonEditor,
} from "@/features/schedule/components/LessonEditor";
import { PlannerCalendar } from "@/features/schedule/components/PlannerCalendar";
import { Account } from "@/features/schedule/components/rail/Account";
import { Brand } from "@/features/schedule/components/rail/Brand";
import { Sidebar } from "@/features/schedule/components/Sidebar";
import { Toolbar } from "@/features/schedule/components/Toolbar";
import { useExports } from "@/features/schedule/hooks/useExports";
import {
	ChangeMarksContext,
	useLessonChanges,
} from "@/features/schedule/hooks/useLessonChanges";
import { usePlanner } from "@/features/schedule/hooks/usePlanner";
import { plural } from "@/features/schedule/lib/format";
import { useUi } from "@/features/schedule/stores/ui";

// SAFETY: shadcn reads its width from this custom property; React's CSSProperties has no slot for it.
const SIDEBAR_STYLE = { "--sidebar-width": "21rem" } as React.CSSProperties;

/** Rate UKMA's header (h-16 and its 1px rule); the planner takes the rest. */
const BELOW_HEADER = "h-[calc(100svh-4rem-1px)]";

/**
 * The planner as Rate UKMA's /schedule page: the site header on top, then
 * the rail, toolbar and grid edge to edge under it, the way the standalone
 * app used the whole screen. Sign-in is Rate UKMA's; the timetable and the
 * plan come from the schedule service under /api/schedule.
 */
export function SchedulePage() {
	return (
		<div className="flex h-svh flex-col overflow-hidden bg-card">
			<Header fluid />
			<TooltipProvider delayDuration={150}>
				<Planner />
			</TooltipProvider>
		</div>
	);
}

function Planner() {
	const planner = usePlanner();
	const exports = useExports(planner);
	const [browseSignal, setBrowseSignal] = useState(0);
	const browseCatalog = () => setBrowseSignal((n) => n + 1);
	const setEditing = useUi((state) => state.setEditing);
	const [keysOpen, setKeysOpen] = useState(false);
	const lessonChanges = useLessonChanges(
		!!planner.me && !!planner.semester && planner.hasSchedule,
	);

	if (planner.loadError) {
		return (
			<div role="alert" className="mx-auto max-w-xl p-10 text-center">
				<p className="text-sm font-medium text-destructive">
					{planner.loadError}
				</p>
				<Button
					size="compact"
					className="mt-4"
					onClick={() => location.reload()}
				>
					Перезавантажити
				</Button>
			</div>
		);
	}

	const semester = planner.semester;
	const { me, inp } = planner;
	if (planner.loading || !semester || !me || !inp) {
		return (
			<div
				className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground"
				role="status"
			>
				<Spinner /> Завантаження розкладу…
			</div>
		);
	}

	return (
		<SidebarProvider
			className={`${BELOW_HEADER} min-h-0 overflow-hidden bg-card`}
			style={SIDEBAR_STYLE}
		>
			<Sidebar
				className="lg:top-[calc(4rem+1px)] lg:h-[calc(100svh-4rem-1px)]"
				browseSignal={browseSignal}
				head={<Brand planner={planner} />}
				foot={
					<Account planner={planner} onShowKeys={() => setKeysOpen(true)} />
				}
				semester={semester}
				inp={inp}
				offerings={planner.pickedOfferings}
				result={planner.result}
				selection={planner.effective}
				names={planner.displayNames}
				registered={planner.registeredByDiscipline}
				resetToSaz={planner.resetToSaz}
				hasRegistered={planner.hasRegistered}
				hasSchedule={planner.hasSchedule}
				bindInp={planner.bindInp}
				switchStream={planner.switchStream}
				archive={planner.isArchive}
				conflicts={planner.conflicts}
				complete={planner.complete}
				remaining={planner.remaining}
				lockPlan={planner.lockPlan}
				unlockPlan={planner.unlockPlan}
				calendar={
					planner.isArchive
						? undefined
						: {
								feed: planner.feed,
								fetchedAt: me.feedFetchedAt ?? null,
								client: me.feedClient ?? null,
							}
				}
			/>
			<SidebarInset className={`${BELOW_HEADER} min-w-0 overflow-hidden`}>
				{planner.scheduleEmpty ? (
					<>
						<div className="flex h-12 shrink-0 items-center border-b border-border/70 px-3">
							<SidebarTrigger
								className="text-muted-foreground"
								title="Дисципліни (B)"
							/>
						</div>
						<EmptySchedule entries={me.inp} />
					</>
				) : (
					<>
						<Toolbar planner={planner} exports={exports} />
						<ChangesBanner
							view={lessonChanges}
							week={planner.week}
							names={planner.displayNames}
							labels={planner.lessons.labels}
						/>
						{planner.pickedOfferings.length > 0 && planner.remaining > 0 && (
							<p
								data-testid="first-steps"
								className="flex shrink-0 flex-wrap items-center gap-x-2 border-b border-border/70 bg-warning/8 px-4 py-1.5 text-xs text-foreground/80"
							>
								{planner.week === undefined ? (
									<>
										Натисни групу на сітці, щоб обрати. Залишилося обрати ще{" "}
										{plural(planner.remaining, ["групу", "групи", "груп"])}.
									</>
								) : (
									<>
										Тиждень {planner.week} показує лише пари цього тижня, тож
										частини груп тут не видно. Обирати зручніше на
										<Button
											variant="link"
											size="xs"
											onClick={() => planner.setWeek(undefined)}
											data-testid="first-steps-semester"
											className="h-auto p-0"
										>
											весь семестр
										</Button>
									</>
								)}
							</p>
						)}
						<div className="min-h-0 flex-1">
							<ChangeMarksContext value={lessonChanges.marks}>
								<PlannerCalendar
									planner={planner}
									onChoose={planner.choose}
									readOnly={planner.locked}
									gridRef={exports.gridRef}
									phoneRef={exports.phoneRef}
									onBrowse={browseCatalog}
									onEdit={(row, name) =>
										setEditing(editOf(row, name, planner.custom))
									}
								/>
							</ChangeMarksContext>
						</div>
					</>
				)}
			</SidebarInset>
			<LessonEditor semester={semester} />
			<Hotkeys
				weeks={planner.weeks}
				thisWeek={planner.thisWeek}
				locked={planner.locked}
				hasClashes={planner.clashCount > 0}
				open={keysOpen}
				onOpenChange={setKeysOpen}
			/>
		</SidebarProvider>
	);
}

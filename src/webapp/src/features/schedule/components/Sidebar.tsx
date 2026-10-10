import type {
	DisciplineId,
	GroupLabel,
	Offering,
	Plan,
	Selection,
} from "@/features/schedule/core";
import { Plus } from "lucide-react";
import { telemetry } from "@/features/schedule/lib/telemetry";
import {
	provenanceOf,
	provenanceUnsure,
} from "@/features/schedule/lib/provenance";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import type { InpResolution } from "@/features/schedule/core";
import type { InpEntry } from "@/features/schedule/core";
import { AddDiscipline } from "@/features/schedule/components/AddDiscipline";
import { useSidebar } from "@/components/ui/Sidebar";
import { DisciplineList } from "@/features/schedule/components/rail/DisciplineList";
import { PlanActions } from "@/features/schedule/components/rail/PlanActions";
import type { CalendarLink } from "@/features/schedule/components/rail/CalendarCard";
import { Button } from "@/components/ui/Button";
import {
	Sidebar as SidebarShell,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarRail,
} from "@/components/ui/Sidebar";
import type { Conflicts as ConflictSet } from "@/features/schedule/core";
import type { Semester } from "@/features/schedule/lib/data";
import { usePlanDraft } from "@/features/schedule/stores/plan";
import { useUi } from "@/features/schedule/stores/ui";

interface Props {
	semester: Semester;
	inp: InpResolution;
	offerings: ReadonlyArray<Offering>;
	result: Plan;
	selection: Selection;
	names: ReadonlyMap<string, string>;
	/** What САЗ has on record, per discipline. */
	registered: Readonly<Record<DisciplineId, GroupLabel>>;
	/** Restore the plan to exactly what САЗ has on record. */
	resetToSaz: () => void;
	hasRegistered?: boolean;
	/** The semester has published rows — an unmatched ІНП line is a naming gap, not a wait. */
	hasSchedule: boolean;
	/** Bind an ІНП line the matcher could not place to the offering the student picks. */
	bindInp: (entry: InpEntry, offering: Offering) => Promise<void>;
	/** A past semester: its own ІНП, records and plan, from the shelf. */
	archive: boolean;
	conflicts: ConflictSet;
	complete: boolean;
	remaining: number;
	lockPlan: () => void;
	unlockPlan: () => void;
	switchStream: (from: DisciplineId, to: DisciplineId) => void;
	/** Bumped by the empty welcome CTA; opens rail + catalog for empty plans. */
	browseSignal?: number;
	/** The feed to subscribe to; absent for a past semester. */
	calendar?: CalendarLink | undefined;
	/** The brand row and the account row: the rail is the app's frame now. */
	head: React.ReactNode;
	foot: React.ReactNode;
	/** Where the fixed rail sits under the site header. */
	className?: string | undefined;
}

/** The quiet rail: what's in the plan, what still needs a pick, nothing more.
 *  Searching, binding and the review queue live in dialogs, so the list of
 *  disciplines never moves under the cursor. */
export function Sidebar(props: Props) {
	const {
		semester,
		inp,
		offerings,
		result,
		selection,
		names,
		registered,
		hasRegistered,
		archive,
		conflicts,
	} = props;
	const { picked, updatePicked, locked } = usePlanDraft();
	const setEditing = useUi((state) => state.setEditing);

	const selectable = result.disciplines.filter((d) => d.candidates.length > 0);
	// Streams the picker ranked or guessed, or that sit on another sheet
	// while the own one publishes them: worth a look before locking.
	const unsureStreams = offerings.filter((offering) =>
		provenanceUnsure(provenanceOf(offering, semester, inp)),
	).length;
	const chosenCount = selectable.filter(
		(d) => selection[d.disciplineId],
	).length;
	const chosenAny = Object.keys(selection).length > 0;
	const [adding, setAdding] = useState(false);
	const [binding, setBinding] = useState<InpEntry>();
	const noInp = inp.published.length === 0 && inp.unpublished.length === 0;

	const openCatalog = (entry?: InpEntry) => {
		setBinding(entry);
		setAdding(true);
	};
	const { setOpenMobile, setOpen } = useSidebar();
	const lastSignal = useRef(props.browseSignal ?? 0);
	useEffect(() => {
		const signal = props.browseSignal ?? 0;
		if (signal !== lastSignal.current) {
			lastSignal.current = signal;
			setOpenMobile(true);
			setOpen(true);
			openCatalog();
		}
	}, [props.browseSignal, setOpenMobile, setOpen]);
	return (
		// On a phone the sheet is named by its title; on a desktop the fixed
		// container gets these, and a label on a role-less div is not announced.
		<SidebarShell
			collapsible="offcanvas"
			role="complementary"
			aria-label="Дисципліни"
			className={props.className}
		>
			<SidebarHeader className="border-b border-sidebar-border px-3 py-3">
				{props.head}
			</SidebarHeader>
			<SidebarContent className="gap-4 px-3 py-3">
				<PlanActions
					locked={locked}
					picked={picked}
					offerings={offerings}
					selection={selection}
					names={names}
					chosenCount={chosenCount}
					selectableCount={selectable.length}
					chosenAny={chosenAny}
					hasRegistered={hasRegistered}
					semesterName={semester.name}
					resetToSaz={props.resetToSaz}
					complete={props.complete}
					remaining={props.remaining}
					lockPlan={props.lockPlan}
					unlockPlan={props.unlockPlan}
					unsureStreams={unsureStreams}
					calendar={props.calendar}
				/>

				{archive ? (
					<section
						className="rounded-md border border-dashed border-border px-3 py-3 text-xs text-muted-foreground"
						data-testid="archive-note"
					>
						<p>
							Минулий семестр. ІНП і групи з САЗ підтягнуто за ним, план
							зберігається окремо від поточного.
						</p>
					</section>
				) : (
					noInp &&
					picked.length === 0 && (
						<section
							className="rounded-md border border-dashed border-border px-3 py-3 text-xs text-muted-foreground"
							data-testid="no-inp"
						>
							<p>
								Твого ІНП тут ще немає. Записи з САЗ підтягуються щогодини.
								Щойно вони з’являться, план збереться сам. А поки що предмети
								можна додати пошуком.
							</p>
						</section>
					)
				)}

				<DisciplineList
					semester={semester}
					inp={inp}
					offerings={offerings}
					result={result}
					selection={selection}
					names={names}
					registered={registered}
					locked={locked}
					hasSchedule={props.hasSchedule}
					conflicts={conflicts}
					openCatalog={openCatalog}
					switchStream={props.switchStream}
					heading={
						<div className="flex h-7 items-center gap-1">
							<h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
								Дисципліни
							</h2>
							{!locked && (
								<Button
									variant="ghost"
									size="xs"
									data-testid="add-discipline"
									onClick={() => openCatalog()}
									title="Будь-яка дисципліна з будь-якого файлу розкладу, не лише з ІНП"
									className="-mr-1 text-primary hover:text-primary"
								>
									<Plus /> Додати
								</Button>
							)}
						</div>
					}
				/>
			</SidebarContent>
			<SidebarFooter className="border-t border-sidebar-border p-0 pb-[env(safe-area-inset-bottom)]">
				{props.foot}
			</SidebarFooter>
			<SidebarRail />
			<AddDiscipline
				semester={semester}
				picked={picked}
				onPick={(id) => {
					updatePicked((prev) => [...prev, id]);
					telemetry.track("discipline_added");
				}}
				bindInp={props.bindInp}
				open={adding}
				onOpenChange={(open) => {
					setAdding(open);
					if (!open) setBinding(undefined);
				}}
				binding={binding}
				onOwnLesson={(seed) => {
					setAdding(false);
					setBinding(undefined);
					setEditing({ kind: "own", ...seed });
				}}
			/>
		</SidebarShell>
	);
}

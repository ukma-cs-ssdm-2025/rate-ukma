import type React from "react";
import type {
	DisciplineId,
	GroupLabel,
	Offering,
	Plan,
	Selection,
} from "@/features/schedule/core";
import { brandIds } from "@/features/schedule/core";
import { inpPickFor, provenanceOf } from "@/features/schedule/lib/provenance";
import { EyeOff, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { RowMenu } from "@/features/schedule/components/rail/RowMenu";
import { usePlanDraft } from "@/features/schedule/stores/plan";
import { Conflicts } from "@/features/schedule/components/Conflicts";
import { Corrections } from "@/features/schedule/components/rail/Corrections";
import { DisciplineRow } from "@/features/schedule/components/rail/DisciplineRow";
import type { Conflicts as ConflictSet } from "@/features/schedule/core";
import type { Semester } from "@/features/schedule/lib/data";
import type { InpResolution } from "@/features/schedule/core";
import type { InpEntry } from "@/features/schedule/core";
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
	locked: boolean;
	/** The semester has published rows — an unmatched ІНП line is a naming gap, not a wait. */
	hasSchedule: boolean;
	conflicts: ConflictSet;
	/** Open the catalog, optionally to bind an ІНП line the matcher missed. */
	openCatalog: (entry?: InpEntry) => void;
	switchStream: (from: DisciplineId, to: DisciplineId) => void;
	/** The list's title row, under the clashes and corrections it explains. */
	heading: React.ReactNode;
}

/** The disciplines in the plan with their clash summary, plus the ІНП lines
 *  the matcher could not place. Searching and binding live in dialogs, so the
 *  list never moves under the cursor. */
export function DisciplineList(props: Props) {
	const {
		semester,
		inp,
		offerings,
		result,
		selection,
		names,
		registered,
		locked,
		hasSchedule,
		conflicts,
		openCatalog,
		switchStream,
		heading,
	} = props;
	const { setFocus, setEditing } = useUi();
	const { hidden, toggleHidden, custom, picked, overrides } = usePlanDraft();
	// A line the student filled with their own lessons is no longer waiting.
	const covered = new Set(custom.flatMap((lesson) => lesson.courseId ?? []));
	const waiting = inp.unpublished.filter(
		(entry) => !covered.has(entry.courseId),
	);
	const publishedCourses = new Set(
		inp.published.map((pick) => pick.entry.courseId),
	);
	const byDiscipline = new Map(
		result.disciplines.map((d) => [d.disciplineId, d]),
	);

	const needsDecision = offerings.filter(
		(offering) =>
			selection[offering.disciplineId] === undefined &&
			(byDiscipline.get(offering.disciplineId)?.candidates.length ?? 0) > 0,
	);
	const decided = offerings.filter(
		(offering) => !needsDecision.includes(offering),
	);

	const renderRow = (offering: Offering) => (
		<DisciplineRow
			key={offering.disciplineId}
			offering={offering}
			semester={semester}
			entry={byDiscipline.get(offering.disciplineId)}
			chosen={selection[offering.disciplineId]}
			names={names}
			registered={registered}
			locked={locked}
			fromInp={inpPickFor(inp, offering.disciplineId) !== undefined}
			provenance={provenanceOf(offering, semester, inp)}
			onSwitchStream={(to) => switchStream(offering.disciplineId, to)}
			publishedCourses={publishedCourses}
		/>
	);

	return (
		<section className="flex flex-col gap-4">
			{offerings.length > 0 && (
				<Conflicts
					result={result}
					conflicts={conflicts}
					names={names}
					setFocus={setFocus}
				/>
			)}
			<Corrections
				printed={semester.offerings.filter((offering) =>
					picked.includes(offering.disciplineId),
				)}
				overrides={overrides}
				custom={custom}
				names={names}
			/>

			<div className="flex flex-col gap-3">
				{heading}
				{needsDecision.length > 0 && (
					<div>
						<SectionTitle count={needsDecision.length}>
							Потребують вибору
						</SectionTitle>
						<ul className="-mx-1.5 flex flex-col gap-0.5">
							{needsDecision.map(renderRow)}
						</ul>
					</div>
				)}
				{decided.length > 0 && (
					<div>
						{needsDecision.length > 0 && (
							<SectionTitle count={decided.length}>Обрані</SectionTitle>
						)}
						<ul className="-mx-1.5 flex flex-col gap-0.5">
							{decided.map(renderRow)}
						</ul>
					</div>
				)}
				{waiting.length > 0 && (
					<div>
						<SectionTitle count={waiting.length}>
							{hasSchedule ? "Без розкладу" : "Розклад ще не опубліковано"}
						</SectionTitle>
						<ul className="-mx-1.5 flex flex-col gap-0.5">
							{waiting.map((entry) => {
								const isHidden = hidden.some((id) => id === entry.courseId);
								return (
									<li
										key={entry.courseId}
										data-testid={`unpublished-${entry.courseId}`}
										className={`group/row min-h-11 rounded-lg px-1.5 py-1.5 hover:bg-background ${isHidden ? "opacity-60" : ""}`}
									>
										<div className="flex items-start gap-1">
											<span
												className="line-clamp-2 min-w-0 flex-1 py-0.5 text-sm leading-snug font-medium text-muted-foreground"
												title={entry.title}
											>
												{entry.title}
											</span>
											{isHidden && (
												<EyeOff
													className="mt-1 size-3.5 shrink-0 text-muted-foreground/60"
													aria-label="приховано"
												/>
											)}
											{!locked && (
												<RowMenu
													id={entry.courseId}
													name={entry.title}
													hidden={isHidden}
													onToggleHidden={() =>
														toggleHidden(brandIds([entry.courseId])[0]!)
													}
													onAddLesson={{
														label: "Ввести пари вручну",
														run: () =>
															setEditing({
																kind: "own",
																name: entry.title,
																courseId: entry.courseId,
															}),
													}}
												/>
											)}
										</div>
										{hasSchedule && !locked && !isHidden && (
											<Button
												variant="link"
												size="xs"
												data-testid={`bind-${entry.courseId}`}
												title="Пари є під іншою назвою, або їх немає в жодному файлі"
												onClick={() => openCatalog(entry)}
												className="h-auto p-0"
											>
												<Search /> Знайти або додати пари
											</Button>
										)}
									</li>
								);
							})}
						</ul>
					</div>
				)}
			</div>
		</section>
	);
}

/** A group of rows in the list, with how many it holds. */
function SectionTitle({
	count,
	children,
}: {
	count: number;
	children: React.ReactNode;
}) {
	return (
		<h3 className="flex items-baseline gap-1.5 pb-1 text-xs font-medium text-muted-foreground">
			{children}
			<span className="text-meta text-muted-foreground/80 tabular-nums">
				{count}
			</span>
		</h3>
	);
}

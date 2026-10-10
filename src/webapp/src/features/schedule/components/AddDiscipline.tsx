import type { DisciplineId, Offering } from "@/features/schedule/core";
import { groupLabels, sheetsOf } from "@/features/schedule/core";
import { CalendarPlus, FileText, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/Dialog";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@/components/ui/InputGroup";
import { splitName } from "@/features/schedule/lib/calendar-events";
import { useWholeSemester } from "@/features/schedule/hooks/usePlanner";
import type { Semester } from "@/features/schedule/lib/data";
import { shortSheet } from "@/features/schedule/lib/provenance";
import { searchOfferings } from "@/features/schedule/lib/search";
import type { InpEntry } from "@/features/schedule/core";

interface Props {
	semester: Semester;
	picked: ReadonlyArray<DisciplineId>;
	onPick: (id: DisciplineId) => void;
	/** Bind an ІНП line the matcher could not place to the offering the student picks. */
	bindInp: (entry: InpEntry, offering: Offering) => Promise<void>;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Set when the dialog was opened to bind an ІНП line rather than to add. */
	binding: InpEntry | undefined;
	/** No sheet has it: add the lessons by hand, seeded with what was searched. */
	onOwnLesson: (seed: {
		readonly name: string;
		readonly courseId?: string;
	}) => void;
}

/**
 * Search across every published sheet, in a dialog so the rail never jumps.
 * The same dialog binds an ІНП line the matcher could not place: «Знайти» on
 * such a line opens it pre-filled, and the add button becomes «Це вона».
 */
export function AddDiscipline(props: Props) {
	const { open, onOpenChange, binding } = props;
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="sm:max-w-lg md:top-24 md:translate-y-0"
				data-testid="extra-catalog"
				phone="top"
			>
				{/* Keyed on the bound line so its title seeds a fresh search. */}
				<Catalog key={binding?.courseId ?? ""} {...props} />
			</DialogContent>
		</Dialog>
	);
}

function Catalog(props: Props) {
	const {
		semester,
		picked,
		onPick,
		bindInp,
		onOpenChange,
		binding,
		onOwnLesson,
	} = props;
	useWholeSemester();
	const [query, setQuery] = useState(
		binding ? binding.title.split(" ").slice(0, 2).join(" ") : "",
	);

	const pickedSet = useMemo(() => new Set(picked), [picked]);
	const labelOf = useMemo(() => {
		const labels = new Map(
			semester.files.map((file) => [file.source, file.label]),
		);
		return (source: string) => labels.get(source) ?? source;
	}, [semester.files]);
	const matches = useMemo(
		() => searchOfferings(semester.offerings, query),
		[semester, query],
	);
	const ownLesson = () =>
		onOwnLesson(
			binding
				? { name: binding.title, courseId: binding.courseId }
				: { name: query.trim() },
		);

	return (
		<>
			<DialogHeader>
				<DialogTitle>
					{binding ? "Яка це дисципліна в розкладі?" : "Додати дисципліну"}
				</DialogTitle>
				<DialogDescription>
					{binding ? (
						<span data-testid="binding-hint">
							В ІНП «{binding.title}». Знайди відповідник нижче.
						</span>
					) : (
						"Будь-який предмет з будь-якого файлу розкладу, не лише з ІНП. Шукай за назвою або викладачем."
					)}
				</DialogDescription>
			</DialogHeader>
			<InputGroup>
				<InputGroupAddon>
					<Search />
				</InputGroupAddon>
				<InputGroupInput
					type="search"
					name="catalog-search"
					autoComplete="off"
					spellCheck={false}
					placeholder="Назва чи викладач, напр. «мережі»…"
					aria-label="Пошук дисципліни"
					value={query}
					// A phone keyboard would cover the results the moment it opens.
					autoFocus={!isTouch()}
					onChange={(event) => setQuery(event.target.value)}
					data-testid="catalog-search"
				/>
			</InputGroup>
			{query.trim() && (
				<ul
					className="-mx-1 max-h-[40svh] divide-y divide-border/50 overflow-y-auto px-1"
					data-testid="catalog-list"
				>
					{matches.length === 0 && (
						<li
							className="py-3 text-xs text-muted-foreground"
							data-testid="catalog-empty"
						>
							{binding
								? "Нічого немає. Спробуй коротшу назву, або факультет ще не опублікував розклад цієї дисципліни: тоді вона з’явиться тут сама."
								: "Нічого немає, спробуй іншу назву."}
						</li>
					)}
					{matches.map(({ offering, teacher }) => {
						const added = pickedSet.has(offering.disciplineId);
						const groups = groupLabels(offering).length;
						const { main } = splitName(offering.discipline);
						const sheets = sheetsOf(offering, labelOf)
							.map(shortSheet)
							.join(", ");
						return (
							<li
								key={offering.disciplineId}
								className="flex items-center gap-2 py-2"
							>
								<div className="min-w-0 flex-1" title={offering.discipline}>
									<div className="truncate text-sm text-foreground">{main}</div>
									<div
										className="truncate text-xs text-muted-foreground"
										data-testid={`catalog-sheet-${offering.disciplineId}`}
									>
										<FileText className="mr-1 inline size-3 align-[-2px]" />
										{sheets}, {groups > 0 ? `груп: ${groups}` : "лише лекції"}
										{teacher && `, ${teacher}`}
									</div>
								</div>
								{binding ? (
									<Button
										size="xs"
										variant="outline"
										data-testid={`bind-to-${offering.disciplineId}`}
										onClick={() => {
											void bindInp(binding, offering).then(() =>
												onOpenChange(false),
											);
										}}
										aria-label={`Це «${binding.title}»: ${offering.discipline}`}
									>
										Це вона
									</Button>
								) : (
									<Button
										size="xs"
										variant={added ? "ghost" : "outline"}
										disabled={added}
										data-testid={`add-${offering.disciplineId}`}
										onClick={() => onPick(offering.disciplineId)}
										aria-label={`Додати ${offering.discipline}`}
									>
										<Plus /> {added ? "У плані" : "Додати"}
									</Button>
								)}
							</li>
						);
					})}
				</ul>
			)}
			<p
				className="flex flex-wrap items-center gap-x-2 border-t border-border/60 pt-3 text-xs text-muted-foreground"
				data-testid="own-lesson-hint"
			>
				{binding ? "Немає в жодному розкладі?" : "Пари немає в жодному файлі?"}
				<Button
					variant="link"
					size="xs"
					className="h-auto p-0"
					data-testid="own-lesson-open"
					onClick={ownLesson}
				>
					<CalendarPlus /> Додати свою пару
				</Button>
			</p>
		</>
	);
}

const isTouch = (): boolean => matchMedia("(pointer: coarse)").matches;

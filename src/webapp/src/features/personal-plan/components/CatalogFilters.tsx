import type { ReactNode } from "react";

import { Search } from "lucide-react";

import { Input } from "@/components/ui/Input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/Select";
import { Slider } from "@/components/ui/Slider";
import { getSemesterTermDisplay } from "@/features/courses/courseFormatting";
import { useAuth } from "@/lib/auth";
import { testIds } from "@/lib/test-ids";
import type { CatalogFilters as Filters } from "../hooks/useCatalogCourses";
import { formatPlanCredits, PLAN_KIND_STYLES } from "../planFormatting";
import { CREDITS_FILTER_RANGE, CREDITS_FILTER_STEP } from "../planRules";
import type { ChoiceKind, PlanSemester, PlanTerm } from "../planTypes";

const KIND_OPTIONS: readonly (ChoiceKind | "all")[] = [
	"all",
	"PROF_ORIENTED",
	"ELECTIVE",
];

function kindOptionLabel(kind: ChoiceKind | "all"): string {
	return kind === "all" ? "Усі" : PLAN_KIND_STYLES[kind].shortLabel;
}

interface CatalogFiltersProps {
	readonly filters: Filters;
	readonly semesters: readonly PlanSemester[];
	readonly onChange: (patch: Partial<Filters>) => void;
}

export function CatalogFilters({
	filters,
	semesters,
	onChange,
}: CatalogFiltersProps) {
	const [minCredits, maxCredits] = filters.credits;
	// Kinds are relative to a speciality; without one the list is unfiltered.
	const { speciality } = useAuth();
	return (
		<div className="flex flex-col gap-3">
			<div className="relative">
				<Search
					aria-hidden
					className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
				/>
				<Input
					type="search"
					value={filters.query}
					onChange={(event) => onChange({ query: event.target.value })}
					aria-label="Пошук дисципліни"
					placeholder="Пошук за назвою"
					className="h-10 pl-9"
					data-testid={testIds.personalPlan.searchInput}
				/>
			</div>
			<div className="flex flex-wrap items-center gap-2">
				<FilterSelect
					label="Семестр"
					value={filters.term}
					onValueChange={(term) => onChange({ term: term as PlanTerm })}
				>
					{semesters.map((semester) => (
						<SelectItem
							key={semester.term}
							value={semester.term}
							disabled={semester.unavailable}
						>
							{getSemesterTermDisplay(semester.term)}
						</SelectItem>
					))}
				</FilterSelect>
				<FilterSelect
					label="Тип"
					value={speciality ? filters.kind : "all"}
					disabled={!speciality}
					onValueChange={(kind) => onChange({ kind: kind as Filters["kind"] })}
				>
					{KIND_OPTIONS.map((kind) => (
						<SelectItem key={kind} value={kind}>
							{kindOptionLabel(kind)}
						</SelectItem>
					))}
				</FilterSelect>
				<fieldset className="flex h-9 min-w-64 grow items-center gap-3 rounded-md border px-3">
					<legend className="sr-only">Кредити ECTS</legend>
					<span
						aria-hidden
						className="text-sm whitespace-nowrap text-muted-foreground"
					>
						Кредити ECTS:
					</span>
					<Slider
						min={CREDITS_FILTER_RANGE[0]}
						max={CREDITS_FILTER_RANGE[1]}
						step={CREDITS_FILTER_STEP}
						minStepsBetweenThumbs={0}
						value={filters.credits}
						onValueChange={(value) =>
							onChange({
								credits: [value[0] ?? minCredits, value[1] ?? maxCredits],
							})
						}
						thumbLabels={["Кредити ECTS, від", "Кредити ECTS, до"]}
						className="min-w-30 grow"
					/>
					<span className="min-w-12 text-right text-sm font-semibold whitespace-nowrap tabular-nums">
						{formatPlanCredits(minCredits)}–{formatPlanCredits(maxCredits)}
					</span>
				</fieldset>
			</div>
		</div>
	);
}

function FilterSelect({
	label,
	value,
	disabled,
	onValueChange,
	children,
}: Readonly<{
	label: string;
	value: string;
	disabled?: boolean;
	onValueChange: (value: string) => void;
	children: ReactNode;
}>) {
	return (
		<Select value={value} disabled={disabled} onValueChange={onValueChange}>
			<SelectTrigger aria-label={label} className="gap-1.5">
				<span className="text-muted-foreground">{label}:</span>
				<span className="font-semibold">
					<SelectValue />
				</span>
			</SelectTrigger>
			<SelectContent>{children}</SelectContent>
		</Select>
	);
}

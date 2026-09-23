import { type ReactNode, useMemo, useState } from "react";

import { ChevronDown, ExternalLink } from "lucide-react";

import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/Collapsible";
import {
	formatAcademicYearLabel,
	formatCredits,
	formatWeeklyHours,
	getSemesterTermDisplay,
} from "@/features/courses/courseFormatting";
import type { CourseOffering, CourseOfferingTerm } from "@/lib/api/generated";

const BASE_CAZ_URL = "https://my.ukma.edu.ua/course/";

const TERM_ORDER: Record<string, number> = {
	FALL: 0,
	SPRING: 1,
	SUMMER: 2,
};

function termRank(term?: string | null): number {
	return TERM_ORDER[(term ?? "").toUpperCase()] ?? 99;
}

function sortOfferings(items: readonly CourseOffering[]): CourseOffering[] {
	return [...items].sort(
		(a, b) =>
			(b.semester_year ?? 0) - (a.semester_year ?? 0) ||
			termRank(a.semester_term) - termRank(b.semester_term),
	);
}

function offeringTerms(offering: CourseOffering): CourseOfferingTerm[] {
	const terms = offering.terms ?? [];
	if (terms.length === 0) return [{ semester_term: offering.semester_term }];
	return [...terms].sort(
		(a, b) =>
			(a.semester_year ?? 0) - (b.semester_year ?? 0) ||
			termRank(a.semester_term) - termRank(b.semester_term),
	);
}

function formatLoad(term: CourseOfferingTerm | undefined): string {
	return [formatCredits(term?.credits), formatWeeklyHours(term?.weekly_hours)]
		.filter(Boolean)
		.join(", ");
}

export interface OfferingTermLoad {
	term: string;
	load: string;
}

export function getLatestOffering(
	offerings: readonly CourseOffering[],
): CourseOffering | undefined {
	return sortOfferings(offerings)[0];
}

export function getLatestOfferingLoads(
	offerings: readonly CourseOffering[],
): OfferingTermLoad[] {
	// Header facts stay minimal (term + credits); the full load lives in the rail.
	const latest = sortOfferings(offerings)[0];
	if (!latest) return [];
	const seen = new Set<string>();
	return offeringTerms(latest).flatMap((term) => {
		if (!term.semester_term || seen.has(term.semester_term)) return [];
		seen.add(term.semester_term);
		const load = formatCredits(term.credits) ?? "";
		return [{ term: term.semester_term, load }];
	});
}

export function runsInOneTerm(offerings: readonly CourseOffering[]): boolean {
	const terms = new Set(
		offerings.flatMap((offering) =>
			offeringTerms(offering).map((term) =>
				(term.semester_term ?? "").toUpperCase(),
			),
		),
	);
	return terms.size <= 1;
}

function loadSignature(offering: CourseOffering): string {
	return formatLoad(offeringTerms(offering)[0]);
}

// One САЗ page can span several terms (e.g. fall and spring on one code).
function termsLabel(offering: CourseOffering): string {
	const seasons = new Set(
		offeringTerms(offering).map((term) => term.semester_term ?? ""),
	);
	return [...seasons]
		.filter(Boolean)
		.map((season) => getSemesterTermDisplay(season))
		.join(", ");
}

function specialitiesLabel(offering: CourseOffering): string {
	return (offering.specialities ?? [])
		.map(
			(speciality) =>
				speciality.speciality_alias || speciality.speciality_title,
		)
		.filter(Boolean)
		.join(", ");
}

const pluralRules = new Intl.PluralRules("uk");
const RECORD_FORMS: Partial<Record<Intl.LDMLPluralRule, string>> = {
	one: "запис",
	few: "записи",
};

function recordsLabel(count: number): string {
	return `${count} ${RECORD_FORMS[pluralRules.select(count)] ?? "записів"}`;
}

interface YearGroup {
	key: string;
	year: string;
	terms: string;
	records: CourseOffering[];
}

// САЗ lists a course once per stream, so one academic year can hold several
// records (up to nine in prod), mostly split by speciality.
function groupByYear(sorted: readonly CourseOffering[]): YearGroup[] {
	const groups = new Map<string, YearGroup>();
	for (const offering of sorted) {
		const year = formatAcademicYearLabel(
			offering.semester_year,
			offering.semester_term,
		);
		const terms = termsLabel(offering);
		const key = `${year}|${terms}`;
		const group = groups.get(key);
		if (group) group.records.push(offering);
		else groups.set(key, { key, year, terms, records: [offering] });
	}
	return [...groups.values()];
}

// Labels for records inside one year: speciality first, then whatever else
// differs between them; the code is the last resort for identical streams.
export function recordLabels(records: readonly CourseOffering[]): string[] {
	const varies = (pick: (offering: CourseOffering) => unknown) =>
		new Set(records.map(pick)).size > 1;
	const showStudyYear = varies((offering) => offering.study_year);
	const showLoad = varies(loadSignature);
	const labels = records.map((offering) =>
		[
			specialitiesLabel(offering),
			showStudyYear && offering.study_year
				? `${offering.study_year} курс`
				: null,
			showLoad ? loadSignature(offering) : null,
		]
			.filter(Boolean)
			.join(", "),
	);
	return labels.map((label, index) => {
		const code = records[index].code;
		const collides =
			!label || labels.some((other, i) => i !== index && other === label);
		if (!collides || !code) return label;
		return label ? `${label}, код ${code}` : `код ${code}`;
	});
}

function RecordLink({
	code,
	label,
	ariaLabel,
	children,
}: Readonly<{
	code?: string;
	label: ReactNode;
	ariaLabel: string;
	children?: ReactNode;
}>) {
	const content = (
		<>
			<span className="inline-flex items-center gap-1">
				{label}
				{code ? (
					<ExternalLink className="size-3 shrink-0" aria-hidden="true" />
				) : null}
			</span>
			{children}
		</>
	);
	if (!code) return <div>{content}</div>;
	return (
		<a
			href={`${BASE_CAZ_URL}${encodeURIComponent(code)}`}
			target="_blank"
			rel="noopener noreferrer"
			aria-label={`${ariaLabel}, відкрити запис у САЗ`}
			className="block underline-offset-4 transition-colors hover:underline"
		>
			{content}
		</a>
	);
}

function YearRow({
	group,
	showTerm,
	latestLoad,
}: Readonly<{ group: YearGroup; showTerm: boolean; latestLoad: string }>) {
	const [open, setOpen] = useState(false);
	const termLabel = showTerm || group.terms.includes(",") ? group.terms : "";
	const heading = (
		<span className="font-medium tabular-nums">{group.year}</span>
	);

	if (group.records.length === 1) {
		const [record] = group.records;
		const load = loadSignature(record);
		const details = [termLabel, load === latestLoad ? null : load]
			.filter(Boolean)
			.join(", ");
		return (
			<RecordLink
				code={record.code}
				label={heading}
				ariaLabel={[group.year, details].filter(Boolean).join(", ")}
			>
				{details ? (
					<span className="block text-muted-foreground">{details}</span>
				) : null}
			</RecordLink>
		);
	}

	const labels = recordLabels(group.records);
	return (
		<Collapsible open={open} onOpenChange={setOpen}>
			<CollapsibleTrigger className="group flex w-full items-baseline gap-2 text-left">
				{heading}
				<span className="inline-flex items-center gap-0.5 text-muted-foreground transition-colors group-hover:text-foreground">
					{[termLabel, recordsLabel(group.records.length)]
						.filter(Boolean)
						.join(", ")}
					<ChevronDown
						className="size-3.5 transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none"
						aria-hidden="true"
					/>
				</span>
			</CollapsibleTrigger>
			<CollapsibleContent>
				<ul className="mt-1.5 space-y-1.5 border-l pl-3">
					{group.records.map((record, index) => (
						<li
							key={record.id ?? record.code}
							className="min-w-0 break-words text-muted-foreground"
						>
							<RecordLink
								code={record.code}
								label={labels[index]}
								ariaLabel={`${group.year}, ${labels[index]}`}
							/>
						</li>
					))}
				</ul>
			</CollapsibleContent>
		</Collapsible>
	);
}

export function CourseCazRecords({
	courseOfferings,
	initialVisible = 3,
}: Readonly<{
	courseOfferings: readonly CourseOffering[];
	initialVisible?: number;
}>) {
	const [expanded, setExpanded] = useState(false);
	const groups = useMemo(
		() => groupByYear(sortOfferings(courseOfferings)),
		[courseOfferings],
	);

	if (groups.length === 0) {
		return null;
	}

	const showTerm = !runsInOneTerm(courseOfferings);
	const latestLoad = loadSignature(groups[0].records[0]);
	const shown = expanded ? groups : groups.slice(0, initialVisible);
	const hiddenCount = groups.length - shown.length;

	return (
		<div>
			<ul className="space-y-2">
				{shown.map((group) => (
					<li key={group.key} className="min-w-0 text-sm">
						<YearRow
							group={group}
							showTerm={showTerm}
							latestLoad={latestLoad}
						/>
					</li>
				))}
			</ul>
			{hiddenCount > 0 && (
				<button
					type="button"
					className="mt-2 text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
					onClick={() => setExpanded(true)}
				>
					ще {hiddenCount}
				</button>
			)}
		</div>
	);
}

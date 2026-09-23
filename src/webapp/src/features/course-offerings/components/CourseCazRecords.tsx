import { useMemo, useState } from "react";

import { ExternalLink } from "lucide-react";

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

// Labels for one year's records. A course taught to several specialities leads
// with the speciality and adds the load only where it changes; otherwise the
// load is the useful per-year fact. The code is the last resort for otherwise
// identical streams.
export function recordLabels(
	records: readonly CourseOffering[],
	bySpeciality: boolean,
	latestLoad = "",
): string[] {
	const varies = (pick: (offering: CourseOffering) => unknown) =>
		new Set(records.map(pick)).size > 1;
	const showStudyYear = varies((offering) => offering.study_year);
	const loadVaries = varies(loadSignature);
	const labels = records.map((offering) =>
		[
			bySpeciality ? specialitiesLabel(offering) : null,
			showStudyYear && offering.study_year
				? `${offering.study_year} курс`
				: null,
			!bySpeciality || loadVaries || loadSignature(offering) !== latestLoad
				? loadSignature(offering)
				: null,
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
}: Readonly<{ code?: string; label: string; ariaLabel: string }>) {
	if (!code) return <span>{label}</span>;
	return (
		<a
			href={`${BASE_CAZ_URL}${encodeURIComponent(code)}`}
			target="_blank"
			rel="noopener noreferrer"
			aria-label={`${ariaLabel}, відкрити запис у САЗ`}
			className="underline-offset-4 transition-colors hover:text-primary hover:underline"
		>
			{/* Glue the icon to the last word so it never wraps onto its own line. */}
			{label.slice(0, label.lastIndexOf(" ") + 1)}
			<span className="whitespace-nowrap">
				{label.slice(label.lastIndexOf(" ") + 1)}
				<ExternalLink
					className="ml-1 inline size-3 align-baseline"
					aria-hidden="true"
				/>
			</span>
		</a>
	);
}

function YearRow({
	group,
	showTerm,
	bySpeciality,
	latestLoad,
}: Readonly<{
	group: YearGroup;
	showTerm: boolean;
	bySpeciality: boolean;
	latestLoad: string;
}>) {
	const termLabel = showTerm || group.terms.includes(",") ? group.terms : "";
	const labels = recordLabels(group.records, bySpeciality, latestLoad);
	return (
		<div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3">
			<div>
				<div className="font-medium tabular-nums">{group.year}</div>
				{termLabel ? (
					<div className="text-xs text-muted-foreground">{termLabel}</div>
				) : null}
			</div>
			<ul className="space-y-1">
				{group.records.map((record, index) => (
					<li key={record.id ?? record.code} className="break-words">
						<RecordLink
							code={record.code}
							label={labels[index] || "Запис у САЗ"}
							ariaLabel={[group.year, termLabel, labels[index]]
								.filter(Boolean)
								.join(", ")}
						/>
					</li>
				))}
			</ul>
		</div>
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
	const bySpeciality = new Set(courseOfferings.map(specialitiesLabel)).size > 1;
	const latestLoad = loadSignature(groups[0].records[0]);
	const shown = expanded ? groups : groups.slice(0, initialVisible);
	const hiddenCount = groups.length - shown.length;

	return (
		<div>
			<ul className="space-y-3">
				{shown.map((group) => (
					<li key={group.key} className="min-w-0 text-sm">
						<YearRow
							group={group}
							showTerm={showTerm}
							bySpeciality={bySpeciality}
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

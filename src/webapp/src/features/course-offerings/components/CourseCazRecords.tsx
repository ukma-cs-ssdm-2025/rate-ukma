import { useMemo, useState } from "react";

import { ExternalLink } from "lucide-react";

import { Collapsible, CollapsibleContent } from "@/components/ui/Collapsible";
import {
	formatAcademicYearLabel,
	formatCredits,
	formatWeeklyHours,
	getSemesterTermDisplay,
} from "@/features/courses/courseFormatting";
import { CourseSpecialityBadges } from "@/features/courses/components/CourseSpecialityBadges";
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
	const linkProps = {
		href: `${BASE_CAZ_URL}${encodeURIComponent(code)}`,
		target: "_blank",
		rel: "noopener noreferrer",
		"aria-label": `${ariaLabel}, відкрити запис у САЗ`,
	};
	if (!label) {
		// The badges carry the meaning; a padded icon keeps a usable tap target.
		return (
			<a
				{...linkProps}
				className="-m-1.5 inline-flex rounded-sm p-1.5 text-muted-foreground transition-colors hover:text-primary"
			>
				<ExternalLink className="size-3.5" aria-hidden="true" />
			</a>
		);
	}
	return (
		<a
			{...linkProps}
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

// The badges already name the speciality, so the link keeps only what else
// tells the streams apart.
function withoutSpeciality(label: string, offering: CourseOffering): string {
	const speciality = specialitiesLabel(offering);
	if (!speciality || !label.startsWith(speciality)) return label;
	return label.slice(speciality.length).replace(/^, /, "");
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
		<>
			<div>
				<div className="font-medium tabular-nums">{group.year}</div>
				{termLabel ? (
					<div className="text-xs text-muted-foreground">{termLabel}</div>
				) : null}
			</div>
			<ul className="col-span-2 grid grid-cols-subgrid gap-y-1.5">
				{group.records.map((record, index) => {
					const label = labels[index] || "Запис у САЗ";
					const ariaLabel = [group.year, termLabel, labels[index]]
						.filter(Boolean)
						.join(", ");
					return (
						<li
							key={record.id ?? record.code}
							className="col-span-2 grid grid-cols-subgrid items-center break-words"
						>
							{bySpeciality ? (
								<>
									<span className="flex">
										<CourseSpecialityBadges
											specialities={record.specialities}
											size="sm"
											includeElective
										/>
									</span>
									<span className="flex items-center">
										<RecordLink
											code={record.code}
											label={withoutSpeciality(label, record)}
											ariaLabel={ariaLabel}
										/>
									</span>
								</>
							) : (
								<span className="col-span-2">
									<RecordLink
										code={record.code}
										label={label}
										ariaLabel={ariaLabel}
									/>
								</span>
							)}
						</li>
					);
				})}
			</ul>
		</>
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
	const renderGroup = (group: YearGroup) => (
		<li key={group.key} className="col-span-3 grid min-w-0 grid-cols-subgrid">
			<YearRow
				group={group}
				showTerm={showTerm}
				bySpeciality={bySpeciality}
				latestLoad={latestLoad}
			/>
		</li>
	);
	const rest = groups.slice(initialVisible);
	const hiddenCount = expanded ? 0 : rest.length;

	return (
		<div>
			{/* One grid for every year, so badges and links line up down the list. */}
			<Collapsible open={expanded} asChild>
				<ul className="grid grid-cols-[5.5rem_fit-content(10rem)_minmax(0,1fr)] gap-x-3 gap-y-3 text-sm">
					{groups.slice(0, initialVisible).map(renderGroup)}
					{rest.length > 0 ? (
						<CollapsibleContent asChild className="mx-0 px-0">
							<li className="col-span-3 grid grid-cols-subgrid">
								<ul className="col-span-3 grid grid-cols-subgrid gap-y-3">
									{rest.map(renderGroup)}
								</ul>
							</li>
						</CollapsibleContent>
					) : null}
				</ul>
			</Collapsible>
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

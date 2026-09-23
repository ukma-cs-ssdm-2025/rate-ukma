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

// Rows matching the latest offering's load hide it so only real changes stand out.
function loadSignature(offering: CourseOffering): string {
	return formatLoad(offeringTerms(offering)[0]);
}

function yearKey(offering: CourseOffering): string {
	return `${offering.semester_year}-${offering.semester_term}`;
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

// САЗ can list the same course twice in one year under different codes; the
// study year (or the code itself) tells the rows apart.
function discriminator(
	offering: CourseOffering,
	siblings: readonly CourseOffering[],
): string | null {
	if (siblings.length < 2) return null;
	const studyYears = new Set(siblings.map((item) => item.study_year));
	if (studyYears.size === siblings.length && offering.study_year) {
		return `${offering.study_year} курс`;
	}
	return offering.code ? `код ${offering.code}` : null;
}

function CazRecordRow({
	offering,
	showTerm,
	showLoad,
	siblings,
}: Readonly<{
	offering: CourseOffering;
	showTerm: boolean;
	showLoad: boolean;
	siblings: readonly CourseOffering[];
}>) {
	const year = formatAcademicYearLabel(
		offering.semester_year,
		offering.semester_term,
	);
	const terms = termsLabel(offering);
	const multiTerm = terms.includes(",");
	const details = [
		showTerm || multiTerm ? terms : null,
		discriminator(offering, siblings),
		showLoad ? loadSignature(offering) : null,
	]
		.filter(Boolean)
		.join(", ");
	const content = (
		<>
			<span className="inline-flex items-center gap-1 font-medium tabular-nums">
				{year}
				{offering.code ? (
					<ExternalLink className="size-3 shrink-0" aria-hidden="true" />
				) : null}
			</span>
			{details ? (
				<span className="block text-muted-foreground">{details}</span>
			) : null}
		</>
	);

	if (!offering.code) {
		return <div>{content}</div>;
	}
	return (
		<a
			href={`${BASE_CAZ_URL}${encodeURIComponent(offering.code)}`}
			target="_blank"
			rel="noopener noreferrer"
			aria-label={`${year}${details ? `, ${details}` : ""}, відкрити запис у САЗ`}
			className="block underline-offset-4 transition-colors hover:underline"
		>
			{content}
		</a>
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
	const sorted = useMemo(
		() => sortOfferings(courseOfferings),
		[courseOfferings],
	);

	if (sorted.length === 0) {
		return null;
	}

	const showTerm = !runsInOneTerm(sorted);
	const latestLoad = loadSignature(sorted[0]);
	const byYear = new Map<string, CourseOffering[]>();
	for (const offering of sorted) {
		const key = yearKey(offering);
		byYear.set(key, [...(byYear.get(key) ?? []), offering]);
	}
	const shown = expanded ? sorted : sorted.slice(0, initialVisible);
	const hiddenCount = sorted.length - shown.length;

	return (
		<div>
			<ul className="space-y-2">
				{shown.map((offering) => (
					<li
						key={offering.id ?? offering.code ?? offering.semester_year}
						className="min-w-0 space-y-0.5 text-sm"
					>
						<CazRecordRow
							offering={offering}
							showTerm={showTerm}
							showLoad={loadSignature(offering) !== latestLoad}
							siblings={byYear.get(yearKey(offering)) ?? []}
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

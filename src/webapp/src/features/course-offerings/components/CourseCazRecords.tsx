import { useMemo, useState } from "react";

import { ExternalLink } from "lucide-react";

import {
	formatAcademicYearLabel,
	formatCredits,
	formatWeeklyHours,
	getSemesterTermDisplay,
} from "@/features/courses/courseFormatting";
import { formatInstructorName } from "@/features/instructors/formatInstructorName";
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

// Signatures of an offering's first term and instructor list. Rows matching
// the latest offering hide that bit so only real changes stand out.
function loadSignature(offering: CourseOffering): string {
	return formatLoad(offeringTerms(offering)[0]);
}

function instructorSignature(offering: CourseOffering): string {
	return (offering.instructors ?? [])
		.map((instructor) =>
			formatInstructorName({
				last_name: instructor.last_name ?? undefined,
				first_name: instructor.first_name ?? undefined,
				patronymic: instructor.patronymic ?? undefined,
			}),
		)
		.filter(Boolean)
		.join(", ");
}

function CazRecordRow({
	offering,
	showTerm,
	showLoad,
	showInstructors,
}: Readonly<{
	offering: CourseOffering;
	showTerm: boolean;
	showLoad: boolean;
	showInstructors: boolean;
}>) {
	const year = formatAcademicYearLabel(
		offering.semester_year,
		offering.semester_term,
	);
	const termLabel =
		showTerm && offering.semester_term
			? getSemesterTermDisplay(offering.semester_term)
			: null;
	const load = showLoad ? loadSignature(offering) : null;
	const details = [termLabel, load].filter(Boolean).join(", ");
	const instructors = showInstructors ? instructorSignature(offering) : "";
	const content = (
		<>
			<p className="inline-flex items-center gap-1 font-medium tabular-nums">
				{year}
				{offering.code ? (
					<ExternalLink className="size-3 shrink-0" aria-hidden="true" />
				) : null}
			</p>
			{details ? (
				<p className="text-muted-foreground">{details}</p>
			) : null}
			{instructors ? (
				<p className="min-w-0 break-words text-muted-foreground">
					{instructors}
				</p>
			) : null}
		</>
	);

	if (!offering.code) {
		return <span title={details || undefined}>{content}</span>;
	}
	return (
		<a
			href={`${BASE_CAZ_URL}${encodeURIComponent(offering.code)}`}
			target="_blank"
			rel="noopener noreferrer"
			title={details || undefined}
			aria-label={`${year}${details ? `, ${details}` : ""}, відкрити запис у САЗ`}
			className="underline-offset-4 transition-colors hover:underline"
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
	const latestInstructors = instructorSignature(sorted[0]);
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
							showInstructors={
								instructorSignature(offering) !== latestInstructors
							}
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

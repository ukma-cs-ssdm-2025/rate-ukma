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

export function getLatestOfferingLoads(
	offerings: readonly CourseOffering[],
): OfferingTermLoad[] {
	const latest = sortOfferings(offerings)[0];
	if (!latest) return [];
	const seen = new Set<string>();
	return offeringTerms(latest).flatMap((term) => {
		if (!term.semester_term || seen.has(term.semester_term)) return [];
		seen.add(term.semester_term);
		return [{ term: term.semester_term, load: formatLoad(term) }];
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

function describeOffering(offering: CourseOffering, showTerm: boolean): string {
	return offeringTerms(offering)
		.map((term) =>
			[
				showTerm && term.semester_term
					? getSemesterTermDisplay(term.semester_term)
					: null,
				formatLoad(term),
			]
				.filter(Boolean)
				.join(", "),
		)
		.filter(Boolean)
		.join("; ");
}

function OfferingYearLink({
	offering,
	showTerm,
}: Readonly<{ offering: CourseOffering; showTerm: boolean }>) {
	const year = formatAcademicYearLabel(
		offering.semester_year,
		offering.semester_term,
	);
	const description = describeOffering(offering, showTerm);

	if (!offering.code) {
		return <span title={description}>{year}</span>;
	}
	return (
		<a
			href={`${BASE_CAZ_URL}${encodeURIComponent(offering.code)}`}
			target="_blank"
			rel="noopener noreferrer"
			title={description}
			aria-label={`${year}, ${description}, відкрити запис у САЗ`}
			className="inline-flex items-center gap-1 tabular-nums transition-colors hover:text-foreground"
		>
			{year}
			<ExternalLink className="size-3" />
		</a>
	);
}

export function CourseCazRecords({
	courseOfferings,
}: Readonly<{ courseOfferings: readonly CourseOffering[] }>) {
	const [expanded, setExpanded] = useState(false);
	const sorted = useMemo(
		() => sortOfferings(courseOfferings),
		[courseOfferings],
	);

	if (sorted.length === 0) {
		return null;
	}

	const showTerm = !runsInOneTerm(sorted);
	const shown = expanded ? sorted : sorted.slice(0, 1);
	const hiddenCount = sorted.length - shown.length;

	return (
		<div
			role="group"
			aria-label="Записи в САЗ"
			className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground"
		>
			<span>САЗ</span>
			{shown.map((offering) => (
				<OfferingYearLink
					key={offering.id ?? offering.code ?? offering.semester_year}
					offering={offering}
					showTerm={showTerm}
				/>
			))}
			{hiddenCount > 0 && (
				<button
					type="button"
					className="underline-offset-4 transition-colors hover:text-foreground hover:underline"
					onClick={() => setExpanded(true)}
				>
					ще {hiddenCount}
				</button>
			)}
		</div>
	);
}

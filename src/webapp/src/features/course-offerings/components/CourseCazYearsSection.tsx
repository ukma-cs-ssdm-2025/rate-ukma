import { useMemo } from "react";

import { ExternalLink } from "lucide-react";

import { TermBadge } from "@/components/TermBadge";
import { Badge } from "@/components/ui/Badge";
import { CourseSpecialityBadges } from "@/features/courses/components/CourseSpecialityBadges";
import {
	formatAcademicYearLabel,
	formatCredits,
	formatWeeklyHours,
} from "@/features/courses/courseFormatting";
import type { CourseOffering, CourseOfferingTerm } from "@/lib/api/generated";

const BASE_CAZ_URL = "https://my.ukma.edu.ua/course/";

const TERM_ORDER: Record<string, number> = {
	FALL: 0,
	SPRING: 1,
	SUMMER: 2,
};

function sortOfferings(items: readonly CourseOffering[]): CourseOffering[] {
	return [...items].sort((a, b) => {
		const yearA = a.semester_year ?? 0;
		const yearB = b.semester_year ?? 0;
		if (yearA !== yearB) return yearB - yearA;

		const termA = TERM_ORDER[(a.semester_term ?? "").toUpperCase()] ?? 99;
		const termB = TERM_ORDER[(b.semester_term ?? "").toUpperCase()] ?? 99;
		return termA - termB;
	});
}

function sortTerms(terms: readonly CourseOfferingTerm[]): CourseOfferingTerm[] {
	return [...terms].sort((a, b) => {
		const yearA = a.semester_year ?? 0;
		const yearB = b.semester_year ?? 0;
		if (yearA !== yearB) return yearA - yearB;

		const termA = TERM_ORDER[(a.semester_term ?? "").toUpperCase()] ?? 99;
		const termB = TERM_ORDER[(b.semester_term ?? "").toUpperCase()] ?? 99;
		return termA - termB;
	});
}

export function getLatestOfferingTerms(
	offerings: readonly CourseOffering[],
): string[] {
	const latest = sortOfferings(offerings)[0];
	if (!latest) return [];
	const terms = latest.terms ?? [];
	const ordered =
		terms.length > 0
			? sortTerms(terms).map((term) => term.semester_term)
			: [latest.semester_term];
	return ordered.filter(
		(term, index): term is string =>
			Boolean(term) && ordered.indexOf(term) === index,
	);
}

function OfferingLoadBadges({
	credits,
	hours,
}: Readonly<{ credits?: string; hours?: number | null }>) {
	const creditsLabel = formatCredits(credits);
	const hoursLabel = formatWeeklyHours(hours);
	if (!creditsLabel && !hoursLabel) {
		return null;
	}
	return (
		<>
			{creditsLabel && (
				<Badge variant="outline" className="font-normal">
					{creditsLabel}
				</Badge>
			)}
			{hoursLabel && (
				<Badge variant="outline" className="font-normal">
					{hoursLabel}
				</Badge>
			)}
		</>
	);
}

export function CourseCazYearsSection({
	courseOfferings,
}: Readonly<{
	courseOfferings: CourseOffering[];
}>) {
	const sorted = useMemo(
		() => sortOfferings(courseOfferings),
		[courseOfferings],
	);

	if (!courseOfferings || courseOfferings.length === 0) {
		return null;
	}

	return (
		<section aria-label="Записи в САЗ" className="space-y-3">
			<h2 className="text-sm font-semibold">
				Записи в САЗ
				<span className="ml-1.5 font-normal text-muted-foreground">
					{sorted.length}
				</span>
			</h2>
			<ul className="divide-y divide-border/60 rounded-xl border bg-card">
				{sorted.map((item) => {
					const terms = item.terms ?? [];
					const [firstTerm] = terms;
					const singleTerm = firstTerm?.semester_term ?? item.semester_term;
					return (
						<li
							key={
								item.id ??
								`${item.code}-${item.semester_year}-${item.semester_term}`
							}
							className="space-y-2 p-3"
						>
							<div className="flex items-center justify-between gap-2">
								<p className="text-sm font-medium">
									{formatAcademicYearLabel(
										item.semester_year,
										item.semester_term,
									)}
								</p>
								{item.code ? (
									<a
										href={`${BASE_CAZ_URL}${encodeURIComponent(item.code)}`}
										target="_blank"
										rel="noopener noreferrer"
										aria-label="Відкрити запис у САЗ"
										className="text-muted-foreground transition-colors hover:text-foreground"
									>
										<ExternalLink className="size-3.5" />
									</a>
								) : null}
							</div>
							{terms.length > 1 ? (
								<ul className="space-y-1.5">
									{sortTerms(terms).map((term) => (
										<li
											key={
												term.id ?? `${term.semester_year}-${term.semester_term}`
											}
											className="flex flex-wrap items-center gap-1.5"
										>
											{term.semester_term && (
												<TermBadge term={term.semester_term} />
											)}
											<OfferingLoadBadges
												credits={term.credits}
												hours={term.weekly_hours}
											/>
										</li>
									))}
								</ul>
							) : (
								<div className="flex flex-wrap items-center gap-1.5">
									{singleTerm && <TermBadge term={singleTerm} />}
									<OfferingLoadBadges
										credits={item.credits}
										hours={item.weekly_hours}
									/>
								</div>
							)}
							{item.specialities && item.specialities.length > 0 ? (
								<CourseSpecialityBadges
									specialities={item.specialities}
									size="sm"
								/>
							) : null}
						</li>
					);
				})}
			</ul>
		</section>
	);
}

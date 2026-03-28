import { useMemo, useState } from "react";

import { BookOpen, ChevronDown, ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/Dialog";
import { CourseSpecialityBadges } from "@/features/courses/components/CourseSpecialityBadges";
import { getSemesterTermDisplay } from "@/features/courses/courseFormatting";
import type { CourseOffering, CourseOfferingTerm } from "@/lib/api/generated";
import { cn } from "@/lib/utils";

const BASE_CAZ_URL = "https://my.ukma.edu.ua/course/";

const TERM_ORDER: Record<string, number> = {
	FALL: 0,
	SPRING: 1,
	SUMMER: 2,
};

function formatCredits(credits?: string): string | null {
	if (!credits) return null;
	const parsed = Number.parseFloat(credits);
	if (!Number.isFinite(parsed)) return `${credits} ECTS`;
	return `${Number.isInteger(parsed) ? parsed.toFixed(0) : parsed.toFixed(1)} ECTS`;
}

function getAcademicStartYear(offering: CourseOffering): number | null {
	if (offering.semester_year == null || !offering.semester_term) return null;
	const term = offering.semester_term.toUpperCase();
	const year = offering.semester_year;
	if (term === "FALL") return year;
	if (term === "SPRING" || term === "SUMMER") return year - 1;
	return null;
}

function formatAcademicYearLabel(offering: CourseOffering): string {
	const startYear = getAcademicStartYear(offering);
	if (startYear == null) return "—";
	return `${startYear}–${startYear + 1}`;
}

function sortOfferings(items: CourseOffering[]): CourseOffering[] {
	return [...items].sort((a, b) => {
		const yearA = a.semester_year ?? 0;
		const yearB = b.semester_year ?? 0;
		if (yearA !== yearB) return yearB - yearA;

		const termA = TERM_ORDER[(a.semester_term ?? "").toUpperCase()] ?? 99;
		const termB = TERM_ORDER[(b.semester_term ?? "").toUpperCase()] ?? 99;
		return termA - termB;
	});
}

/**
 * Returns compact metadata from the most recent offering
 * for display in the course header.
 */
export type OfferingMetaBadge = {
	label: string;
	color: string;
};

function getCreditsColor(credits: number): string {
	if (credits <= 2)
		return "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800";
	if (credits <= 3)
		return "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800";
	if (credits <= 4)
		return "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800";
	if (credits <= 6)
		return "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800";
	if (credits <= 8)
		return "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800";
	return "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800";
}

function getSemesterTermColor(term: string): string {
	switch (term.toUpperCase()) {
		case "FALL":
			return "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800";
		case "SPRING":
			return "bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-900/30 dark:text-pink-300 dark:border-pink-800";
		case "SUMMER":
			return "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800";
		default:
			return "";
	}
}

export function getLatestOfferingMeta(
	offerings: CourseOffering[],
): OfferingMetaBadge[] {
	const sorted = sortOfferings(offerings);
	const latest = sorted[0];
	if (!latest) return [];

	const badges: OfferingMetaBadge[] = [];

	// Combined credits + hours badge
	const creditsStr = formatCredits(latest.credits);
	const hoursStr =
		latest.weekly_hours != null ? `${latest.weekly_hours} год` : null;
	if (creditsStr || hoursStr) {
		const label = [creditsStr, hoursStr].filter(Boolean).join(" · ");
		const parsedCredits = latest.credits
			? Number.parseFloat(latest.credits)
			: 0;
		badges.push({
			label,
			color: getCreditsColor(parsedCredits),
		});
	}

	// Semester terms
	const terms = latest.terms ?? [];
	if (terms.length > 0) {
		for (const term of sortTerms(terms)) {
			if (term.semester_term) {
				badges.push({
					label: getSemesterTermDisplay(term.semester_term),
					color: getSemesterTermColor(term.semester_term),
				});
			}
		}
	} else if (latest.semester_term) {
		badges.push({
			label: getSemesterTermDisplay(latest.semester_term),
			color: getSemesterTermColor(latest.semester_term),
		});
	}

	return badges;
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

function OfferingTermsBadges({
	terms,
}: Readonly<{ terms: readonly CourseOfferingTerm[] }>) {
	if (terms.length === 0)
		return <span className="text-muted-foreground">—</span>;

	const sorted = sortTerms(terms);

	return (
		<div className="flex flex-wrap gap-1">
			{sorted.map((term) => (
				<Badge
					key={term.id ?? `${term.semester_year}-${term.semester_term}`}
					variant="outline"
					className={cn(
						"text-[10px] px-1.5 py-0 font-normal",
						getSemesterTermColor(term.semester_term ?? "") ||
							"text-muted-foreground",
					)}
				>
					{getSemesterTermDisplay(term.semester_term ?? "", "—")}
				</Badge>
			))}
		</div>
	);
}

function OfferingTermDetails({
	terms,
}: Readonly<{ terms: readonly CourseOfferingTerm[] }>) {
	if (terms.length <= 1) return null;

	const sorted = sortTerms(terms);

	return (
		<div className="mt-1.5 space-y-1 pl-2 border-l-2 border-border/30">
			{sorted.map((term) => {
				const credits = formatCredits(term.credits);
				const weeklyHours =
					term.weekly_hours != null ? `${term.weekly_hours} год/тиж` : null;
				const examType =
					term.exam_type === "EXAM"
						? "Іспит"
						: term.exam_type === "CREDIT"
							? "Залік"
							: null;
				const parts = [credits, weeklyHours, examType].filter(Boolean);

				return (
					<div
						key={term.id ?? `${term.semester_year}-${term.semester_term}`}
						className="text-xs text-muted-foreground"
					>
						<span className="font-medium text-foreground/80">
							{getSemesterTermDisplay(term.semester_term ?? "", "—")}
						</span>
						{parts.length > 0 && (
							<span className="ml-1.5">{parts.join(" · ")}</span>
						)}
					</div>
				);
			})}
		</div>
	);
}

export function CourseCazYearsSection({
	courseOfferings,
}: Readonly<{
	courseOfferings: CourseOffering[];
}>) {
	const [open, setOpen] = useState(false);

	const sorted = useMemo(
		() => sortOfferings(courseOfferings),
		[courseOfferings],
	);

	if (!courseOfferings || courseOfferings.length === 0) {
		return null;
	}

	return (
		<>
			<Button
				variant="ghost"
				size="sm"
				onClick={() => setOpen(true)}
				className="text-muted-foreground"
			>
				<BookOpen className="mr-1.5 h-3.5 w-3.5" />
				Записи в САЗ ({sorted.length})
				<ChevronDown className="ml-1 h-3.5 w-3.5" />
			</Button>

			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>Записи в САЗ</DialogTitle>
					</DialogHeader>

					<div className="overflow-x-auto">
						<table className="w-full text-sm">
							<thead>
								<tr className="border-b border-border/40 text-left text-xs text-muted-foreground">
									<th className="pb-2 pr-4 font-medium">Рік</th>
									<th className="pb-2 pr-4 font-medium">Семестри</th>
									<th className="pb-2 pr-4 font-medium">Кредити</th>
									<th className="pb-2 pr-4 font-medium">Спеціальності</th>
									<th className="pb-2 font-medium">САЗ</th>
								</tr>
							</thead>
							<tbody>
								{sorted.map((item) => {
									const credits = formatCredits(item.credits);
									const terms = item.terms ?? [];
									const hasMultipleTerms = terms.length > 1;

									return (
										<tr
											key={
												item.id ??
												`${item.code}-${item.semester_year}-${item.semester_term}`
											}
											className="border-b border-border/20 last:border-b-0"
										>
											<td className="py-2.5 pr-4 whitespace-nowrap text-foreground">
												{formatAcademicYearLabel(item)}
											</td>
											<td className="py-2.5 pr-4">
												{terms.length > 0 ? (
													<OfferingTermsBadges terms={terms} />
												) : (
													<span className="text-muted-foreground">—</span>
												)}
											</td>
											<td className="py-2.5 pr-4 whitespace-nowrap tabular-nums">
												{credits ?? "—"}
												{hasMultipleTerms && (
													<OfferingTermDetails terms={terms} />
												)}
											</td>
											<td className="py-2.5 pr-4">
												{item.specialities && item.specialities.length > 0 ? (
													<CourseSpecialityBadges
														specialities={item.specialities}
														size="sm"
													/>
												) : (
													<span className="text-muted-foreground">—</span>
												)}
											</td>
											<td className="py-2.5">
												{item.code ? (
													<a
														href={`${BASE_CAZ_URL}${encodeURIComponent(item.code)}`}
														target="_blank"
														rel="noopener noreferrer"
														className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
													>
														<ExternalLink className="h-3.5 w-3.5" />
													</a>
												) : (
													<span className="text-muted-foreground">—</span>
												)}
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}

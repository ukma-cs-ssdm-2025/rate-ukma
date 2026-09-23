import { useMemo, useState } from "react";

import { ExternalLink } from "lucide-react";

import { TermBadge } from "@/components/TermBadge";
import { Button } from "@/components/ui/Button";
import { CourseSpecialityBadges } from "@/features/courses/components/CourseSpecialityBadges";
import {
	formatAcademicYearLabel,
	formatCredits,
	formatWeeklyHours,
} from "@/features/courses/courseFormatting";
import type { CourseOffering, CourseOfferingTerm } from "@/lib/api/generated";
import { cn } from "@/lib/utils";

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

function formatLoad(term: CourseOfferingTerm | undefined): string {
	return [formatCredits(term?.credits), formatWeeklyHours(term?.weekly_hours)]
		.filter(Boolean)
		.join(", ");
}

function offeringTerms(offering: CourseOffering): CourseOfferingTerm[] {
	const terms = offering.terms ?? [];
	return terms.length > 0
		? sortTerms(terms)
		: [{ semester_term: offering.semester_term }];
}

// Offerings that repeat year after year with the same terms, load and
// specialities collapse into one group, so those facts are shown once.
function signatureOf(offering: CourseOffering): string {
	const terms = offeringTerms(offering)
		.map(
			(term) =>
				`${term.semester_term ?? ""}:${term.credits ?? ""}:${term.weekly_hours ?? ""}`,
		)
		.join("|");
	const specialities = (offering.specialities ?? [])
		.map((speciality) => speciality.speciality_id ?? "")
		.sort()
		.join(",");
	return `${terms}#${specialities}`;
}

interface OfferingGroup {
	key: string;
	offerings: CourseOffering[];
}

function groupOfferings(sorted: readonly CourseOffering[]): OfferingGroup[] {
	const groups = new Map<string, CourseOffering[]>();
	for (const offering of sorted) {
		const key = signatureOf(offering);
		const group = groups.get(key);
		if (group) group.push(offering);
		else groups.set(key, [offering]);
	}
	return [...groups].map(([key, offerings]) => ({ key, offerings }));
}

const VISIBLE_YEARS = 4;
const VISIBLE_GROUPS = 3;

function OfferingYearLink({
	offering,
}: Readonly<{ offering: CourseOffering }>) {
	const label = formatAcademicYearLabel(
		offering.semester_year,
		offering.semester_term,
	);
	if (!offering.code) {
		return <span className="text-muted-foreground">{label}</span>;
	}
	return (
		<a
			href={`${BASE_CAZ_URL}${encodeURIComponent(offering.code)}`}
			target="_blank"
			rel="noopener noreferrer"
			aria-label={`${label}, відкрити запис у САЗ`}
			className="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
		>
			{label}
			<ExternalLink className="size-3" />
		</a>
	);
}

function OfferingGroupItem({ group }: Readonly<{ group: OfferingGroup }>) {
	const [expanded, setExpanded] = useState(false);
	const [first] = group.offerings;
	const hiddenCount = group.offerings.length - VISIBLE_YEARS;
	const visible = expanded
		? group.offerings
		: group.offerings.slice(0, VISIBLE_YEARS);

	return (
		<li className="space-y-2">
			<div className="flex flex-wrap items-center gap-2 text-sm">
				{offeringTerms(first).map((term, index) => (
					<span
						key={`${term.semester_term}-${index}`}
						className="inline-flex items-center gap-2"
					>
						{term.semester_term && <TermBadge term={term.semester_term} />}
						<span className="text-muted-foreground">{formatLoad(term)}</span>
					</span>
				))}
				<CourseSpecialityBadges specialities={first.specialities} size="sm" />
			</div>
			<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
				{visible.map((offering) => (
					<OfferingYearLink
						key={
							offering.id ??
							`${offering.code}-${offering.semester_year}-${offering.semester_term}`
						}
						offering={offering}
					/>
				))}
				{!expanded && hiddenCount > 0 && (
					<Button
						variant="ghost"
						size="sm"
						className="h-auto px-1.5 py-0.5"
						onClick={() => setExpanded(true)}
					>
						Ще {hiddenCount}
					</Button>
				)}
			</div>
		</li>
	);
}

export function CourseCazYearsSection({
	courseOfferings,
	className,
}: Readonly<{
	courseOfferings: CourseOffering[];
	className?: string;
}>) {
	const [showAllGroups, setShowAllGroups] = useState(false);
	const groups = useMemo(
		() => groupOfferings(sortOfferings(courseOfferings)),
		[courseOfferings],
	);

	if (!courseOfferings || courseOfferings.length === 0) {
		return null;
	}

	const visibleGroups = showAllGroups
		? groups
		: groups.slice(0, VISIBLE_GROUPS);

	return (
		<section aria-label="Записи в САЗ" className={cn("space-y-3", className)}>
			<h2 className="text-sm font-semibold">
				Записи в САЗ
				<span className="ml-1.5 font-normal text-muted-foreground">
					{courseOfferings.length}
				</span>
			</h2>
			<ul className="space-y-5">
				{visibleGroups.map((group) => (
					<OfferingGroupItem key={group.key} group={group} />
				))}
			</ul>
			{!showAllGroups && groups.length > VISIBLE_GROUPS && (
				<Button
					variant="ghost"
					size="sm"
					className="-ml-2"
					onClick={() => setShowAllGroups(true)}
				>
					Показати всі
				</Button>
			)}
		</section>
	);
}

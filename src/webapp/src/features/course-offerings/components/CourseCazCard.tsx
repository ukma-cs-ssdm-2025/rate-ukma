import { useMemo, useState } from "react";

import { ChevronDown, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
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
import { cn } from "@/lib/utils";

const BASE_CAZ_URL = "https://my.ukma.edu.ua/course/";
const VISIBLE_ROWS = 3;

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

function OfferingRow({
	offering,
	showTerm,
}: Readonly<{ offering: CourseOffering; showTerm: boolean }>) {
	const year = formatAcademicYearLabel(
		offering.semester_year,
		offering.semester_term,
	);
	return (
		<li className="flex items-baseline justify-between gap-3 py-1 text-sm">
			{offering.code ? (
				<a
					href={`${BASE_CAZ_URL}${encodeURIComponent(offering.code)}`}
					target="_blank"
					rel="noopener noreferrer"
					aria-label={`${year}, відкрити запис у САЗ`}
					className="inline-flex shrink-0 items-center gap-1 font-medium tabular-nums transition-colors hover:text-primary"
				>
					{year}
					<ExternalLink className="size-3 text-muted-foreground" />
				</a>
			) : (
				<span className="shrink-0 font-medium tabular-nums">{year}</span>
			)}
			<span className="min-w-0 truncate text-right text-muted-foreground">
				{describeOffering(offering, showTerm)}
			</span>
		</li>
	);
}

export function CourseCazCard({
	courseOfferings,
	className,
}: Readonly<{
	courseOfferings: readonly CourseOffering[];
	className?: string;
}>) {
	const [open, setOpen] = useState(false);
	const sorted = useMemo(
		() => sortOfferings(courseOfferings),
		[courseOfferings],
	);
	const showTerm = !runsInOneTerm(sorted);

	if (sorted.length === 0) {
		return null;
	}

	const visible = sorted.slice(0, VISIBLE_ROWS);
	const hidden = sorted.slice(VISIBLE_ROWS);

	return (
		<Card className={cn("shadow-sm", className)}>
			<CardContent className="p-4 sm:p-5">
				<Collapsible asChild open={open} onOpenChange={setOpen}>
					<section aria-label="Записи в САЗ">
						<div className="flex min-h-5 items-center justify-between gap-2">
							<p className="text-sm font-medium text-muted-foreground">
								Записи в САЗ
							</p>
							{hidden.length > 0 && (
								<CollapsibleTrigger asChild>
									<Button
										variant="ghost"
										size="sm"
										className="-my-1.5 -mr-2 h-8 gap-1 px-2 text-muted-foreground"
									>
										{open ? "Згорнути" : `Усі ${sorted.length}`}
										<ChevronDown
											className={cn(
												"size-3.5 transition-transform duration-200",
												open && "rotate-180",
											)}
										/>
									</Button>
								</CollapsibleTrigger>
							)}
						</div>
						<ul className="mt-2">
							{visible.map((offering) => (
								<OfferingRow
									key={offering.id ?? offering.code ?? offering.semester_year}
									offering={offering}
									showTerm={showTerm}
								/>
							))}
						</ul>
						{hidden.length > 0 && (
							<CollapsibleContent>
								<ul>
									{hidden.map((offering) => (
										<OfferingRow
											key={
												offering.id ?? offering.code ?? offering.semester_year
											}
											offering={offering}
											showTerm={showTerm}
										/>
									))}
								</ul>
							</CollapsibleContent>
						)}
					</section>
				</Collapsible>
			</CardContent>
		</Card>
	);
}

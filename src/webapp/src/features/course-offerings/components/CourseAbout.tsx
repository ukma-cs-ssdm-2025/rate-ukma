import { ExpandableText } from "@/components/ui/ExpandableText";
import {
	formatCredits,
	formatWeeklyHours,
	getExamTypeDisplay,
} from "@/features/courses/courseFormatting";
import type { CourseOffering, CourseOfferingTerm } from "@/lib/api/generated";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { CourseCazRecords } from "./CourseCazRecords";

function factText(value: string | null): string | null {
	return value && value !== "—" ? value : null;
}

function firstTerm(
	offering: CourseOffering | undefined,
): CourseOfferingTerm | undefined {
	if (!offering) return undefined;
	return (
		offering.terms?.[0] ??
		(offering.semester_term
			? { semester_term: offering.semester_term }
			: undefined)
	);
}

// The load a student weighs first when enrolling, from the latest offering.
export function offeringLoad(offering: CourseOffering | undefined): {
	credits: string | null;
	weeklyHours: string | null;
} {
	const term = firstTerm(offering);
	return {
		credits: factText(formatCredits(term?.credits)),
		weeklyHours: formatWeeklyHours(term?.weekly_hours),
	};
}

export function offeringExamType(
	offering: CourseOffering | undefined,
): string | null {
	const examType = firstTerm(offering)?.exam_type ?? offering?.exam_type;
	return getExamTypeDisplay(examType ?? null, "") || null;
}

interface CourseAboutProps {
	description?: string | null;
	latestOffering?: CourseOffering;
	courseOfferings: readonly CourseOffering[];
}

export function CourseAbout({
	description,
	latestOffering,
	courseOfferings,
}: Readonly<CourseAboutProps>) {
	const isPhone = !useMediaQuery("(min-width: 1024px)");
	const exam = offeringExamType(latestOffering);

	return (
		<section aria-label="Про курс" className="min-w-0 space-y-5">
			<h2 className="text-lg font-semibold tracking-tight">Про курс</h2>
			{description ? (
				<ExpandableText
					lines={isPhone ? 3 : 4}
					className="text-sm leading-relaxed text-muted-foreground sm:text-base"
				>
					{description}
				</ExpandableText>
			) : null}
			{exam ? (
				<dl>
					<dt className="text-xs text-muted-foreground">Форма контролю</dt>
					<dd className="mt-0.5 text-sm font-medium">{exam}</dd>
				</dl>
			) : null}
			{courseOfferings.length > 0 ? (
				<div className="space-y-2 pt-1">
					<h3 className="text-sm font-semibold">Записи в САЗ</h3>
					<CourseCazRecords
						courseOfferings={courseOfferings}
						initialVisible={isPhone ? 2 : 3}
					/>
				</div>
			) : null}
		</section>
	);
}

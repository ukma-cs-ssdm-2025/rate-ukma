import { ExpandableText } from "@/components/ui/ExpandableText";
import {
	formatCredits,
	formatWeeklyHours,
	getExamTypeDisplay,
} from "@/features/courses/courseFormatting";
import { formatInstructorName } from "@/features/instructors/formatInstructorName";
import type { CourseOffering, CourseOfferingTerm } from "@/lib/api/generated";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { CourseCazRecords } from "./CourseCazRecords";

function formatHours(value?: number | null): string | null {
	if (value == null) return null;
	return `${value} год`;
}

function factText(value: string | null): string | null {
	return value && value !== "—" ? value : null;
}

// Compact facts from the latest offering's first term: only present fields.
export function offeringFacts(
	offering: CourseOffering | undefined,
): Array<{ label: string; value: string }> {
	if (!offering) return [];
	const term: CourseOfferingTerm | undefined =
		offering.terms?.[0] ??
		(offering.semester_term
			? { semester_term: offering.semester_term }
			: undefined);
	const facts: Array<{ label: string; value: string }> = [];
	const credits = factText(formatCredits(term?.credits));
	if (credits) facts.push({ label: "Кредити", value: credits });
	const weekly = formatWeeklyHours(term?.weekly_hours);
	if (weekly) facts.push({ label: "Годин на тиждень", value: weekly });
	const total = formatHours(term?.total_hours);
	if (total) facts.push({ label: "Всього годин", value: total });
	if (term?.lecture_count != null)
		facts.push({ label: "Лекції", value: `${term.lecture_count}` });
	if (term?.practice_count != null)
		facts.push({ label: "Практики", value: `${term.practice_count}` });
	const examType = term?.exam_type ?? offering.exam_type;
	const exam = getExamTypeDisplay(examType ?? null, "");
	if (exam) facts.push({ label: "Форма контролю", value: exam });
	return facts;
}

function offeringInstructorNames(offering: CourseOffering): string[] {
	return (offering.instructors ?? [])
		.map((instructor) =>
			formatInstructorName({
				last_name: instructor.last_name ?? undefined,
				first_name: instructor.first_name ?? undefined,
				patronymic: instructor.patronymic ?? undefined,
			}),
		)
		.filter(Boolean);
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
	const facts = offeringFacts(latestOffering);
	const instructors = latestOffering
		? offeringInstructorNames(latestOffering)
		: [];

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
			{facts.length > 0 ? (
				<dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
					{facts.map((fact) => (
						<div key={fact.label} className="min-w-0">
							<dt className="text-xs text-muted-foreground">{fact.label}</dt>
							<dd className="mt-0.5 text-sm font-medium tabular-nums">
								{fact.value}
							</dd>
						</div>
					))}
				</dl>
			) : null}
			{instructors.length > 0 ? (
				<p className="text-sm">
					<span className="text-muted-foreground">Викладачі: </span>
					{instructors.join(", ")}
				</p>
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

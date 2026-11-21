import { ExpandableText } from "@/components/ui/ExpandableText";
import { Skeleton } from "@/components/ui/Skeleton";
import {
	formatCredits,
	formatWeeklyHours,
	getExamTypeDisplay,
} from "@/features/courses/courseFormatting";
import type { CourseOffering, CourseOfferingTerm } from "@/lib/api/generated";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { CourseCazRecords } from "./CourseCazRecords";
import {
	CourseHistoryChips,
	CourseHistoryDisclosure,
	CourseHistoryRows,
} from "./CourseHistoryCompact";

export type PanelVariant = "before" | "a" | "b" | "c";

function factText(value: string | null): string | null {
	return value && value !== "—" ? value : null;
}

function firstTerm(
	offering: CourseOffering | undefined,
): CourseOfferingTerm | undefined {
	return offering?.terms[0];
}

// The load a student weighs first when enrolling, from the latest offering.
interface OfferingLoad {
	credits: string | null;
	weeklyHours: string | null;
}

export function offeringLoad(
	offering: CourseOffering | undefined,
): OfferingLoad {
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
	return examType ? getExamTypeDisplay(examType) : null;
}

interface CourseAboutProps {
	description?: string | null;
	latestOffering?: CourseOffering;
	courseOfferings: readonly CourseOffering[];
	variant?: PanelVariant;
}

export function CourseAbout({
	description,
	latestOffering,
	courseOfferings,
	variant = "before",
}: Readonly<CourseAboutProps>) {
	const isPhone = !useMediaQuery("(min-width: 1024px)");
	const exam = offeringExamType(latestOffering);

	if (variant !== "before") {
		return (
			<div className="min-w-0 space-y-6">
				{description ? (
					<section aria-label="Про дисципліну" className="space-y-3">
						<h2 className="text-lg font-semibold tracking-tight">
							Про дисципліну
						</h2>
						<ExpandableText
							lines={isPhone ? 3 : 4}
							className="text-sm leading-relaxed text-muted-foreground sm:text-base"
						>
							{description}
						</ExpandableText>
					</section>
				) : null}
				{courseOfferings.length > 0 && variant === "b" ? (
					<CourseHistoryDisclosure courseOfferings={courseOfferings} />
				) : null}
				{courseOfferings.length > 0 && variant !== "b" ? (
					<section aria-label="Історія дисципліни" className="space-y-2">
						<h3 className="text-sm font-semibold">Історія дисципліни</h3>
						{variant === "a" ? (
							<CourseHistoryRows courseOfferings={courseOfferings} />
						) : (
							<CourseHistoryChips courseOfferings={courseOfferings} />
						)}
					</section>
				) : null}
			</div>
		);
	}

	return (
		<section aria-label="Про дисципліну" className="min-w-0 space-y-5">
			<h2 className="text-lg font-semibold tracking-tight">Про дисципліну</h2>
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
					<h3 className="text-sm font-semibold">Історія дисципліни</h3>
					<CourseCazRecords
						courseOfferings={courseOfferings}
						initialVisible={isPhone ? 2 : 3}
					/>
				</div>
			) : null}
		</section>
	);
}

export function CourseAboutSkeleton() {
	return (
		<div className="space-y-5" aria-hidden="true">
			<Skeleton className="h-6 w-24" />
			<div className="space-y-2">
				<Skeleton className="h-4 w-full" />
				<Skeleton className="h-4 w-full" />
				<Skeleton className="h-4 w-2/3" />
			</div>
			<div className="space-y-1.5">
				<Skeleton className="h-3 w-24" />
				<Skeleton className="h-4 w-16" />
			</div>
			<div className="space-y-2.5">
				<Skeleton className="h-4 w-28" />
				<Skeleton className="h-4 w-full" />
				<Skeleton className="h-4 w-full" />
			</div>
		</div>
	);
}

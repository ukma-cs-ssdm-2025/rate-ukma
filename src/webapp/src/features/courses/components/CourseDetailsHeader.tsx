import type { ReactNode } from "react";

import { TermBadge } from "@/components/TermBadge";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import type {
	CourseOfferingSpeciality,
	EducationLevelEnum,
} from "@/lib/api/generated";
import { testIds } from "@/lib/test-ids";
import { CourseSpecialityBadges } from "./CourseSpecialityBadges";
import { getEducationLevelDisplay } from "../courseFormatting";

const SINGLE_LINE_SPECIALITIES = 4;

interface CourseDetailsHeaderProps {
	title: string;
	educationLevel?: EducationLevelEnum | null;
	specialities?: readonly CourseOfferingSpeciality[];
	departmentName?: string | null;
	facultyName?: string | null;
	terms?: readonly string[];
	credits?: string | null;
	weeklyHours?: string | null;
	/** Prototype: the exam form joins the facts. */
	examType?: string | null;
	/** Rows under the badges, such as the course's teachers. */
	children?: ReactNode;
}

export function CourseDetailsHeader({
	title,
	educationLevel,
	specialities,
	departmentName,
	facultyName,
	terms = [],
	credits,
	weeklyHours,
	examType,
	children,
}: Readonly<CourseDetailsHeaderProps>) {
	const meta = [
		educationLevel ? getEducationLevelDisplay(educationLevel) : null,
		facultyName,
		departmentName,
	].filter(Boolean);

	const specialityCount = (specialities ?? []).filter(
		(speciality) =>
			speciality.speciality_id &&
			speciality.speciality_title &&
			speciality.type_kind !== "ELECTIVE",
	).length;
	const specialityBadges = (
		<CourseSpecialityBadges specialities={specialities} />
	);
	const hasFacts =
		terms.length > 0 ||
		Boolean(credits) ||
		Boolean(weeklyHours) ||
		Boolean(examType);
	const facts = hasFacts ? (
		<span className="inline-flex flex-wrap items-center gap-1.5">
			{terms.map((term) => (
				<TermBadge key={term} term={term} />
			))}
			{credits || weeklyHours ? (
				<Badge
					variant="outline"
					className="border-transparent bg-muted tabular-nums"
				>
					{[credits, weeklyHours].filter(Boolean).join(" / ")}
					{weeklyHours ? <span className="sr-only"> на тиждень</span> : null}
				</Badge>
			) : null}
			{examType ? (
				<Badge variant="outline" className="border-transparent bg-muted">
					{examType}
				</Badge>
			) : null}
		</span>
	) : null;

	return (
		<header className="min-w-0 space-y-3">
			<h1
				className="max-w-4xl text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl"
				data-testid={testIds.courseDetails.title}
			>
				{title}
			</h1>

			{meta.length > 0 && (
				<p className="text-sm text-muted-foreground">{meta.join(", ")}</p>
			)}

			{(specialityCount > 0 || facts) && (
				<div className="max-w-4xl space-y-2">
					{/* One line while it fits; general courses list up to twenty
					    specialities, so those get their own line under the facts. */}
					{specialityCount > SINGLE_LINE_SPECIALITIES ? (
						<>
							{facts}
							<div>{specialityBadges}</div>
						</>
					) : (
						<div className="flex flex-wrap items-center gap-1.5">
							{specialityBadges}
							{facts}
						</div>
					)}
				</div>
			)}

			{children}
		</header>
	);
}

export function CourseDetailsHeaderSkeleton() {
	return (
		<header className="min-w-0 space-y-3">
			<Skeleton className="h-9 w-2/3 lg:h-10" />
			<Skeleton className="h-4 w-full max-w-md" />
			<div className="flex gap-1.5">
				<Skeleton className="h-5 w-9 rounded-full" />
				<Skeleton className="h-5 w-14 rounded-full" />
				<Skeleton className="h-5 w-24 rounded-full" />
			</div>
		</header>
	);
}

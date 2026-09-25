import { TermBadge } from "@/components/TermBadge";
import { Skeleton } from "@/components/ui/Skeleton";
import type { EducationLevelEnum, TypeKindEnum } from "@/lib/api/generated";
import { testIds } from "@/lib/test-ids";
import { CourseSpecialityBadges } from "./CourseSpecialityBadges";
import { getEducationLevelDisplay } from "../courseFormatting";

interface CourseDetailsHeaderProps {
	title: string;
	educationLevel?: EducationLevelEnum | null;
	specialities?: ReadonlyArray<{
		readonly speciality_id?: string;
		readonly speciality_title?: string;
		readonly speciality_alias?: string | null;
		readonly faculty_id?: string;
		readonly faculty_name?: string;
		readonly type_kind?: TypeKindEnum;
	}> | null;
	departmentName?: string | null;
	facultyName?: string | null;
	terms?: readonly string[];
	credits?: string | null;
	weeklyHours?: string | null;
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
}: Readonly<CourseDetailsHeaderProps>) {
	const meta = [
		getEducationLevelDisplay(educationLevel),
		facultyName,
		departmentName,
	].filter(Boolean);

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

			{((specialities?.length ?? 0) > 0 ||
				terms.length > 0 ||
				credits ||
				weeklyHours) && (
				<div className="flex max-w-4xl flex-wrap items-center gap-1.5">
					<CourseSpecialityBadges specialities={specialities} />
					{terms.map((term) => (
						<TermBadge key={term} term={term} />
					))}
					{credits || weeklyHours ? (
						<span className="ml-2 inline-flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
							{credits ? (
								<span className="font-medium text-foreground tabular-nums">
									{credits}
								</span>
							) : null}
							{weeklyHours ? (
								<span>
									<span className="font-medium text-foreground tabular-nums">
										{weeklyHours}
									</span>{" "}
									на тиждень
								</span>
							) : null}
						</span>
					) : null}
				</div>
			)}
		</header>
	);
}

export function CourseDetailsHeaderSkeleton() {
	return (
		<header className="min-w-0 space-y-3">
			<Skeleton className="h-9 w-2/3" />
			<Skeleton className="h-4 w-48" />
			<div className="flex gap-1.5">
				<Skeleton className="h-5 w-12" />
				<Skeleton className="h-5 w-14" />
				<Skeleton className="h-5 w-10" />
				<Skeleton className="h-5 w-20" />
				<Skeleton className="h-5 w-12" />
			</div>
		</header>
	);
}

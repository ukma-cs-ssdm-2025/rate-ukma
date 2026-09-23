import { TermBadge } from "@/components/TermBadge";
import { Skeleton } from "@/components/ui/Skeleton";
import type { OfferingTermLoad } from "@/features/course-offerings/components/CourseCazCard";
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
	termLoads?: readonly OfferingTermLoad[];
}

export function CourseDetailsHeader({
	title,
	educationLevel,
	specialities,
	departmentName,
	facultyName,
	termLoads = [],
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

			{((specialities?.length ?? 0) > 0 || termLoads.length > 0) && (
				<div className="flex max-w-4xl flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
					<CourseSpecialityBadges specialities={specialities} />
					{termLoads.map(({ term, load }) => (
						<span key={term} className="inline-flex items-center gap-1.5">
							<TermBadge term={term} />
							{load && <span className="text-muted-foreground">{load}</span>}
						</span>
					))}
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

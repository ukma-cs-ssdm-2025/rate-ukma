import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import type { OfferingMetaBadge } from "@/features/course-offerings/components/CourseCazYearsSection";
import type { EducationLevelEnum, TypeKindEnum } from "@/lib/api/generated";
import { testIds } from "@/lib/test-ids";
import { cn } from "@/lib/utils";
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
	offeringBadges?: OfferingMetaBadge[];
	cazButton?: React.ReactNode;
}

export function CourseDetailsHeader({
	title,
	educationLevel,
	specialities,
	departmentName,
	facultyName,
	offeringBadges,
	cazButton,
}: Readonly<CourseDetailsHeaderProps>) {
	const educationLevelLabel = getEducationLevelDisplay(educationLevel);
	const metaParts = [facultyName, departmentName].filter(Boolean);

	return (
		<header className="space-y-3">
			<div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
				<h1
					className="max-w-4xl text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl"
					data-testid={testIds.courseDetails.title}
				>
					{title}
				</h1>
				{cazButton}
			</div>

			{(metaParts.length > 0 || educationLevelLabel) && (
				<p className="text-sm text-muted-foreground">
					{educationLevelLabel && (
						<span className="mr-2 inline-flex items-center rounded-sm border px-1.5 py-0.5 text-xs font-medium text-muted-foreground align-middle">
							{educationLevelLabel}
						</span>
					)}
					{metaParts.join(" · ")}
				</p>
			)}

			<div className="flex flex-wrap items-center gap-x-3 gap-y-2">
				<CourseSpecialityBadges specialities={specialities} />

				{offeringBadges && offeringBadges.length > 0 && (
					<>
						{(specialities?.length ?? 0) > 0 && (
							<span className="text-border">|</span>
						)}
						<div className="flex flex-wrap items-center gap-1.5">
							{offeringBadges.map((badge) => (
								<Badge
									key={badge.label}
									variant="outline"
									className={cn(
										"px-2 py-0.5 text-xs font-normal",
										badge.color || "text-muted-foreground",
									)}
								>
									{badge.label}
								</Badge>
							))}
						</div>
					</>
				)}
			</div>
		</header>
	);
}

export function CourseDetailsHeaderSkeleton() {
	return (
		<header className="space-y-3">
			<div className="flex flex-wrap items-center gap-3">
				<Skeleton className="h-9 w-2/3" />
				<Skeleton className="h-7 w-28" />
			</div>
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

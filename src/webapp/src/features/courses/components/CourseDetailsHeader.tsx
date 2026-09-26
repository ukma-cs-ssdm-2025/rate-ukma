import { TermBadge } from "@/components/TermBadge";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import type { EducationLevelEnum, TypeKindEnum } from "@/lib/api/generated";
import { testIds } from "@/lib/test-ids";
import { CourseSpecialityBadges } from "./CourseSpecialityBadges";
import { getEducationLevelDisplay } from "../courseFormatting";

const SINGLE_LINE_SPECIALITIES = 4;

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

	const specialityCount = (specialities ?? []).filter(
		(speciality) =>
			speciality.speciality_id &&
			speciality.speciality_title &&
			speciality.type_kind !== "ELECTIVE",
	).length;
	const specialityBadges = (
		<CourseSpecialityBadges specialities={specialities} />
	);
	const hasFacts = terms.length > 0 || Boolean(credits) || Boolean(weeklyHours);
	const facts = hasFacts ? (
		<span className="inline-flex flex-wrap items-center gap-1.5">
			{terms.map((term) => (
				<TermBadge key={term} term={term} />
			))}
			{credits ? (
				<Badge
					variant="outline"
					className="border-transparent bg-muted tabular-nums"
				>
					{credits}
				</Badge>
			) : null}
			{weeklyHours ? (
				<Badge
					variant="outline"
					className="border-transparent bg-muted tabular-nums"
				>
					{weeklyHours} на тиждень
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

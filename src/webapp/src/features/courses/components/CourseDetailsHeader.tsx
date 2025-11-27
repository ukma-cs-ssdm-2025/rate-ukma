import { GraduationCap } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { CourseSpecialityBadges } from "./CourseSpecialityBadges";
import { getStatusLabel, getStatusVariant } from "../courseFormatting";

interface CourseDetailsHeaderProps {
	title: string;
	status: string;
	specialities?: ReadonlyArray<{
		readonly speciality_id?: string;
		readonly speciality_title?: string;
		readonly speciality_alias?: string | null;
		readonly faculty_id?: string;
		readonly faculty_name?: string;
	}> | null;
	departmentName?: string | null;
}

export function CourseDetailsHeader({
	title,
	status,
	specialities,
	departmentName,
}: Readonly<CourseDetailsHeaderProps>) {
	return (
		<header className="space-y-3">
			<div className="flex flex-wrap items-center gap-3">
				<h1 className="text-3xl font-bold tracking-tight">{title}</h1>
				<Badge variant={getStatusVariant(status)}>
					{getStatusLabel(status)}
				</Badge>
			</div>
			<div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
				<CourseSpecialityBadges specialities={specialities} />
				{departmentName && (
					<Badge variant="outline" className="text-xs">
						<GraduationCap className="mr-1.5 h-3.5 w-3.5" />
						{departmentName}
					</Badge>
				)}
			</div>
		</header>
	);
}

export function CourseDetailsHeaderSkeleton() {
	return (
		<header className="space-y-3">
			<div className="flex flex-wrap items-center gap-3">
				<Skeleton className="h-8 w-2/3" />
				<Skeleton className="h-5 w-20" />
			</div>
			<div className="flex flex-wrap items-center gap-2">
				<Skeleton className="h-5 w-24" />
				<Skeleton className="h-5 w-32" />
			</div>
		</header>
	);
}

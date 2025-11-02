import { GraduationCap } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { CourseFacultyBadge } from "./CourseFacultyBadge";
import { getStatusLabel, getStatusVariant } from "../courseFormatting";

interface CourseDetailsHeaderProps {
	title: string;
	status: string;
	facultyName?: string | null;
	departmentName?: string | null;
}

export function CourseDetailsHeader({
	title,
	status,
	facultyName,
	departmentName,
}: CourseDetailsHeaderProps) {
	return (
		<header className="space-y-3">
			<div className="flex flex-wrap items-center gap-3">
				<h1 className="text-3xl font-bold tracking-tight">{title}</h1>
				<Badge variant={getStatusVariant(status)}>
					{getStatusLabel(status)}
				</Badge>
			</div>
			<div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
				{facultyName && <CourseFacultyBadge facultyName={facultyName} />}
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

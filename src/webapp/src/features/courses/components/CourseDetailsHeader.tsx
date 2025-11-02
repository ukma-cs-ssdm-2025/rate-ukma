import { ArrowLeft, GraduationCap } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CourseFacultyBadge } from "./CourseFacultyBadge";
import { getStatusLabel, getStatusVariant } from "../courseFormatting";

interface CourseDetailsHeaderProps {
	title: string;
	status: string;
	facultyName?: string | null;
	departmentName?: string | null;
	onBack: () => void;
}

export function CourseDetailsHeader({
	title,
	status,
	facultyName,
	departmentName,
	onBack,
}: CourseDetailsHeaderProps) {
	return (
		<>
			<div className="flex items-center gap-4">
				<Button variant="outline" onClick={onBack} size="sm">
					<ArrowLeft className="mr-2 h-4 w-4" />
					Назад до курсів
				</Button>
			</div>

			<div className="space-y-3">
				<div className="flex items-start justify-between gap-4">
					<h1 className="text-4xl font-bold tracking-tight">{title}</h1>
					<Badge variant={getStatusVariant(status)}>
						{getStatusLabel(status)}
					</Badge>
				</div>
				<div className="flex items-center gap-3">
					{facultyName && <CourseFacultyBadge facultyName={facultyName} />}
					{departmentName && (
						<Badge variant="outline" className="text-sm">
							<GraduationCap className="mr-1.5 h-3.5 w-3.5" />
							{departmentName}
						</Badge>
					)}
				</div>
			</div>
		</>
	);
}

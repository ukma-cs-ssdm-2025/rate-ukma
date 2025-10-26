import { Badge } from "@/components/ui/Badge";
import { getFacultyAbbreviation } from "../courseFormatting";

interface CourseFacultyBadgeProps {
	facultyName?: string | null;
}

export function CourseFacultyBadge({ facultyName }: CourseFacultyBadgeProps) {
	if (!facultyName) {
		return null;
	}

	const abbreviation = getFacultyAbbreviation(facultyName);

	return (
		<Badge variant="secondary" className="font-medium text-xs px-2 py-0.5">
			{abbreviation}
		</Badge>
	);
}

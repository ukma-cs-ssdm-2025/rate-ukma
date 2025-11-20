import { Badge } from "@/components/ui/Badge";
import { getFacultyColors } from "@/lib/faculty-colors";
import { cn } from "@/lib/utils";
import { getFacultyAbbreviation } from "../courseFormatting";

interface CourseFacultyBadgeProps {
	facultyName?: string | null;
	facultyCustomAbbreviation?: string | null;
}

export function CourseFacultyBadge({
	facultyName,
	facultyCustomAbbreviation,
}: Readonly<CourseFacultyBadgeProps>) {
	if (!facultyName) {
		return null;
	}

	const abbreviation =
		facultyCustomAbbreviation || getFacultyAbbreviation(facultyName);
	const colors = getFacultyColors(facultyName);

	return (
		<Badge
			variant="secondary"
			className={cn(
				"font-medium text-xs px-2 py-0.5",
				colors.bg,
				colors.text,
				colors.border,
				"border",
			)}
		>
			{abbreviation}
		</Badge>
	);
}

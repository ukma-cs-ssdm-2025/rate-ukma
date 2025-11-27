import { Badge } from "@/components/ui/Badge";
import { getFacultyColors } from "@/lib/faculty-colors";
import { cn } from "@/lib/utils";

interface CourseSpecialityBadgesProps {
	specialities?: ReadonlyArray<{
		readonly speciality_id?: string;
		readonly speciality_title?: string;
		readonly speciality_alias?: string | null;
		readonly faculty_id?: string;
		readonly faculty_name?: string;
	}> | null;
}

function getSpecialityAlias(
	name: string,
	customAbbreviation?: string | null,
): string {
	if (customAbbreviation) {
		return customAbbreviation;
	}
	// Extract first letters of each word
	const matches = name.match(/\b\w/g);
	return matches
		? matches.join("").toUpperCase()
		: name.substring(0, 3).toUpperCase();
}

export function CourseSpecialityBadges({
	specialities,
}: Readonly<CourseSpecialityBadgesProps>) {
	if (!specialities || specialities.length === 0) {
		return null;
	}

	// Filter out specialities without required data
	const validSpecialities = specialities.filter(
		(s) => s.speciality_id && s.speciality_title,
	);

	if (validSpecialities.length === 0) {
		return null;
	}

	return (
		<span className="inline-flex flex-wrap gap-1.5">
			{validSpecialities.map((speciality) => {
				const abbreviation = getSpecialityAlias(
					speciality.speciality_title || "",
					speciality.speciality_alias,
				);
				const colors = getFacultyColors(speciality.faculty_id || "");

				// Create tooltip with speciality and faculty names
				const tooltipText = speciality.faculty_name
					? `${speciality.speciality_title} — ${speciality.faculty_name}`
					: speciality.speciality_title;

				return (
					<Badge
						key={speciality.speciality_id}
						variant="secondary"
						className={cn(
							"font-medium text-xs px-2 py-0.5",
							colors.bg,
							colors.text,
							colors.border,
							"border",
						)}
						title={tooltipText}
					>
						{abbreviation}
					</Badge>
				);
			})}
		</span>
	);
}

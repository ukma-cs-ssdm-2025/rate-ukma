import { useId, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/Tooltip";
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

	const separator = /[\s-]+/;

	if (name.split(separator).length === 1) {
		return name;
	}

	return name
		.split(separator)
		.map((word) => word.replaceAll(/[^\p{L}]/gu, ""))
		.filter((word) => word.length > 0)
		.map((word) => word[0])
		.join("")
		.toUpperCase();
}

const MAX_VISIBLE_BADGES = 5;

export function CourseSpecialityBadges({
	specialities,
}: Readonly<CourseSpecialityBadgesProps>) {
	const [isExpanded, setIsExpanded] = useState(false);
	const badgesId = useId();

	if (!specialities || specialities.length === 0) {
		return null;
	}

	const validSpecialities = specialities.filter(
		(s) => s.speciality_id && s.speciality_title,
	);

	if (validSpecialities.length === 0) {
		return null;
	}

	const hasHiddenBadges = validSpecialities.length > MAX_VISIBLE_BADGES;
	const displayedSpecialities = isExpanded
		? validSpecialities
		: validSpecialities.slice(0, MAX_VISIBLE_BADGES);
	const hiddenCount = validSpecialities.length - MAX_VISIBLE_BADGES;

	return (
		<span id={badgesId} className="inline-flex flex-wrap gap-1.5">
			{displayedSpecialities.map((speciality) => {
				const abbreviation = getSpecialityAlias(
					speciality.speciality_title || "",
					speciality.speciality_alias,
				);
				const colors = getFacultyColors(speciality.faculty_name || "");

				return (
					<Tooltip key={speciality.speciality_id}>
						<TooltipTrigger asChild>
							<Badge
								variant="secondary"
								className={cn(
									"font-medium text-xs px-2 py-0.5 cursor-default",
									colors.bg,
									colors.text,
									colors.border,
									"border",
								)}
							>
								{abbreviation}
							</Badge>
						</TooltipTrigger>
						<TooltipContent side="top" className="max-w-xs">
							<div className="text-center">
								{speciality.faculty_name && (
									<div className="text-xs opacity-90 mb-0.5">
										{speciality.faculty_name}
									</div>
								)}
								<div className="font-medium">{speciality.speciality_title}</div>
							</div>
						</TooltipContent>
					</Tooltip>
				);
			})}
			{hasHiddenBadges && (
				<button
					type="button"
					className="text-xs text-muted-foreground font-semibold px-2 py-0.5 rounded-md hover:bg-muted hover:text-foreground transition-colors cursor-pointer speciality-badges-trigger"
					aria-expanded={isExpanded}
					aria-label={
						isExpanded
							? "Приховати додаткові спеціальності"
							: `Показати ще ${hiddenCount} спеціальностей`
					}
					aria-controls={badgesId}
					onClick={(e) => {
						e.preventDefault();
						e.stopPropagation();
						setIsExpanded(!isExpanded);
					}}
				>
					{isExpanded ? "Менше" : `+${hiddenCount} більше`}
				</button>
			)}
		</span>
	);
}

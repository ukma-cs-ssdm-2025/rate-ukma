import { useId, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/Tooltip";
import type { TypeKindEnum } from "@/lib/api/generated";
import { getFacultyColors } from "@/lib/faculty-colors";
import { cn } from "@/lib/utils";
import { getCourseTypeDisplay } from "../courseFormatting";

interface CourseSpecialityBadgesProps {
	specialities?: ReadonlyArray<{
		readonly speciality_id?: string;
		readonly speciality_title?: string;
		readonly speciality_alias?: string | null;
		readonly faculty_id?: string;
		readonly faculty_name?: string;
		readonly type_kind?: TypeKindEnum;
	}> | null;
	size?: "default" | "sm";
	/** САЗ records keep elective streams; the course header hides them. */
	includeElective?: boolean;
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
	size = "default",
	includeElective = false,
}: Readonly<CourseSpecialityBadgesProps>) {
	const [isExpanded, setIsExpanded] = useState(false);
	const badgesId = useId();

	if (!specialities || specialities.length === 0) {
		return null;
	}

	const validSpecialities = specialities.filter(
		(s) =>
			s.speciality_id &&
			s.speciality_title &&
			(includeElective || s.type_kind !== "ELECTIVE"),
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

				const kind = getCourseTypeDisplay(speciality.type_kind ?? "", "");

				return (
					<Tooltip key={speciality.speciality_id}>
						<TooltipTrigger asChild>
							<Badge
								variant="secondary"
								className={cn(
									"cursor-default border text-xs",
									size === "sm" ? "px-1.5 py-0" : "px-2 py-0.5",
									colors.bg,
									colors.text,
									colors.border,
								)}
							>
								{abbreviation}
								<span className="sr-only">
									{`: ${speciality.speciality_title}${kind ? `, ${kind}` : ""}`}
								</span>
							</Badge>
						</TooltipTrigger>
						<TooltipContent side="top" className="max-w-xs text-center">
							<p className="font-medium">{speciality.speciality_title}</p>
							{kind ? <p>{kind}</p> : null}
						</TooltipContent>
					</Tooltip>
				);
			})}
			{hasHiddenBadges && (
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="h-5 px-1.5 font-medium text-muted-foreground hover:text-foreground"
					aria-expanded={isExpanded}
					aria-label={
						isExpanded ? "Згорнути спеціальності" : "Показати всі спеціальності"
					}
					aria-controls={badgesId}
					onClick={(e) => {
						e.preventDefault();
						e.stopPropagation();
						setIsExpanded(!isExpanded);
					}}
				>
					{isExpanded ? "Згорнути" : `ще ${hiddenCount}`}
				</Button>
			)}
		</span>
	);
}

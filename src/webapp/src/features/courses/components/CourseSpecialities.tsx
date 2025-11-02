import { GraduationCap } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import type { SpecialityWithKindPayload } from "@/lib/api/generated";
import { getTypeKindLabel, getTypeKindVariant } from "../courseFormatting";

interface CourseSpecialitiesProps {
	specialities: SpecialityWithKindPayload[];
}

export function CourseSpecialities({ specialities }: CourseSpecialitiesProps) {
	if (!specialities || specialities.length === 0) {
		return null;
	}

	return (
		<div className="space-y-4">
			<h2 className="text-2xl font-semibold">Спеціальності</h2>
			<div className="grid gap-3 sm:grid-cols-2">
				{specialities.map((item, index) => (
					<div
						key={`${item.speciality}-${item.type_kind}-${index}`}
						className="flex items-center justify-between p-4 rounded-lg border bg-card"
					>
						<div className="flex items-center gap-2">
							<GraduationCap className="h-4 w-4 text-muted-foreground" />
							<p className="font-medium">{item.speciality}</p>
						</div>
						<Badge variant={getTypeKindVariant(item.type_kind)}>
							{getTypeKindLabel(item.type_kind)}
						</Badge>
					</div>
				))}
			</div>
		</div>
	);
}

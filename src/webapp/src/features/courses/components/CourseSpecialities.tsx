import { GraduationCap } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import type { CourseSpecialityInline } from "@/lib/api/generated";
import { getTypeKindLabel, getTypeKindVariant } from "../courseFormatting";

interface CourseSpecialitiesProps {
	specialities: CourseSpecialityInline[];
}

export function CourseSpecialities({
	specialities,
}: Readonly<CourseSpecialitiesProps>) {
	if (!specialities || specialities.length === 0) {
		return null;
	}

	return (
		<div className="space-y-3">
			<h2 className="text-xl font-semibold">Спеціальності</h2>
			<div className="grid gap-2 sm:grid-cols-2">
				{specialities.map((item, index) => (
					<div
						key={`${item.speciality_title}-${item.type_kind}-${index}`}
						className="flex items-center justify-between py-3 px-4 rounded-lg border border-border/50 bg-card/50"
					>
						<div className="flex items-center gap-2">
							<GraduationCap className="h-4 w-4 text-muted-foreground/60" />
							<p className="text-sm font-medium">
								{item.speciality_title ?? "—"}
							</p>
						</div>
						{item.type_kind && (
							<Badge variant={getTypeKindVariant(item.type_kind)}>
								{getTypeKindLabel(item.type_kind)}
							</Badge>
						)}
					</div>
				))}
			</div>
		</div>
	);
}

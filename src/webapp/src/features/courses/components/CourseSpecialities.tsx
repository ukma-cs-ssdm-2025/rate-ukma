import { Badge } from "@/components/ui/Badge";
import type { CourseOfferingSpecialityInline } from "@/lib/api/generated";
import { getTypeKindLabel, getTypeKindVariant } from "../courseFormatting";

interface CourseSpecialitiesProps {
	specialities: CourseOfferingSpecialityInline[];
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
						className="flex items-center justify-between gap-2 rounded-lg border border-border/50 bg-card/50 px-4 py-3"
					>
						<p className="text-sm font-medium">
							{item.speciality_title ?? "—"}
						</p>
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

import { Badge } from "@/components/ui/Badge";
import { getFacultyColors } from "@/lib/faculty-colors";
import { getDifficultyTone, getUsefulnessTone } from "@/lib/score-tone";
import type { CourseDataPoint } from "./scatterLabeling";

const TOOLTIP_DECIMAL_PLACES = 2;

function FacultyBadge({ name }: Readonly<{ name: string }>) {
	const colors = getFacultyColors(name);
	return (
		<Badge
			variant="secondary"
			className={[colors.bg, colors.text, colors.border].join(" ")}
			title={name}
		>
			{name}
		</Badge>
	);
}

export function ScatterPlotTooltipCard({
	point: tooltipData,
}: Readonly<{ point: CourseDataPoint }>) {
	return (
		<div className="bg-popover text-popover-foreground border rounded-md shadow-md p-3 text-sm max-w-xs">
			<div className="flex flex-wrap items-start gap-2 mb-2">
				<div className="font-medium leading-tight">{tooltipData.name}</div>
				<FacultyBadge name={tooltipData.facultyName} />
			</div>
			<div className="space-y-1 text-muted-foreground">
				<div className="flex justify-between gap-4">
					<span>Корисність:</span>
					<span className={`font-medium ${getUsefulnessTone(tooltipData.x)}`}>
						{tooltipData.x.toFixed(TOOLTIP_DECIMAL_PLACES)}
					</span>
				</div>
				<div className="flex justify-between gap-4">
					<span>Складність:</span>
					<span className={`font-medium ${getDifficultyTone(tooltipData.y)}`}>
						{tooltipData.y.toFixed(TOOLTIP_DECIMAL_PLACES)}
					</span>
				</div>
				<div className="flex justify-between gap-4">
					<span>Відгуків:</span>
					<span className="font-medium text-foreground">
						{tooltipData.ratingsCount}
					</span>
				</div>
			</div>
		</div>
	);
}

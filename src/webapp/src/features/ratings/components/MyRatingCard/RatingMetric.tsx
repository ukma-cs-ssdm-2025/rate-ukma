import { cn } from "@/lib/utils";

interface RatingMetricProps {
	label: string;
	value: string;
	valueClassName?: string;
}

export function RatingMetric({
	label,
	value,
	valueClassName,
}: Readonly<RatingMetricProps>) {
	return (
		<div className="flex items-baseline gap-2">
			<span className="text-xs text-muted-foreground">{label}:</span>
			<span className={cn("text-base font-semibold", valueClassName)}>
				{value}
			</span>
		</div>
	);
}

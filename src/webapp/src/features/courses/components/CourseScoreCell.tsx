import { cn } from "@/lib/utils";
import {
	formatDecimalValue,
	getDifficultyTone,
	getUsefulnessTone,
} from "../courseFormatting";

interface CourseScoreCellProps {
	value?: number;
	variant: "difficulty" | "usefulness";
}

export function CourseScoreCell({
	value,
	variant,
}: Readonly<CourseScoreCellProps>) {
	if (!value) {
		return (
			<div className="flex items-center justify-end">
				<span className="font-medium tabular-nums text-muted-foreground">
					-
				</span>
			</div>
		);
	}

	const tone =
		variant === "difficulty"
			? getDifficultyTone(value)
			: getUsefulnessTone(value);

	return (
		<div className="flex items-center justify-end">
			<span
				className={cn("font-semibold tabular-nums text-base md:text-lg", tone)}
			>
				{formatDecimalValue(value, { fallback: "-" })}
			</span>
		</div>
	);
}

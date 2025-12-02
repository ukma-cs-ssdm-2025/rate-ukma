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
			<div className="flex items-center justify-center">
				<span className="font-medium text-muted-foreground">-</span>
			</div>
		);
	}

	const tone =
		variant === "difficulty"
			? getDifficultyTone(value)
			: getUsefulnessTone(value);

	return (
		<div className="flex items-center justify-center">
			<span className={cn("text-base font-semibold md:text-lg", tone)}>
				{formatDecimalValue(value, { fallback: "-" })}
			</span>
		</div>
	);
}

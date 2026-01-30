import { cn } from "@/lib/utils";

interface CircularProgressProps {
	value: number;
	size?: number;
	strokeWidth?: number;
	className?: string;
	trackClassName?: string;
	progressClassName?: string;
}

export function CircularProgress({
	value,
	size = 24,
	strokeWidth = 3,
	className,
	trackClassName,
	progressClassName,
}: Readonly<CircularProgressProps>) {
	const radius = (size - strokeWidth) / 2;
	const circumference = 2 * Math.PI * radius;
	const offset = circumference - (value / 100) * circumference;

	return (
		<svg
			width={size}
			height={size}
			className={cn("-rotate-90", className)}
			aria-hidden="true"
		>
			<circle
				cx={size / 2}
				cy={size / 2}
				r={radius}
				fill="none"
				strokeWidth={strokeWidth}
				className={cn("stroke-muted", trackClassName)}
			/>
			<circle
				cx={size / 2}
				cy={size / 2}
				r={radius}
				fill="none"
				strokeWidth={strokeWidth}
				strokeDasharray={circumference}
				strokeDashoffset={offset}
				strokeLinecap="round"
				className={cn(
					"stroke-primary transition-all duration-300",
					progressClassName,
				)}
			/>
		</svg>
	);
}

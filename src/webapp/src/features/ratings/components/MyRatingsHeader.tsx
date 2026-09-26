import { useEffect, useState } from "react";

import { PageHeader } from "@/components/PageHeader";
import { testIds } from "@/lib/test-ids";

interface MyRatingsHeaderProps {
	totalCourses: number;
	ratedCourses: number;
	/** Unrated courses whose rating window is already open. */
	rateableLeft?: number;
}

const RADIUS = 26;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function ProgressRing({ share }: Readonly<{ share: number }>) {
	// Starts empty and fills after the first paint so the arc sweeps in.
	const [shown, setShown] = useState(0);
	useEffect(() => {
		const frame = requestAnimationFrame(() => setShown(share));
		return () => cancelAnimationFrame(frame);
	}, [share]);

	return (
		<span className="relative flex size-16 shrink-0 items-center justify-center">
			<svg viewBox="0 0 64 64" className="absolute inset-0 -rotate-90">
				<circle
					cx="32"
					cy="32"
					r={RADIUS}
					fill="none"
					strokeWidth="6"
					className="stroke-muted"
				/>
				<circle
					cx="32"
					cy="32"
					r={RADIUS}
					fill="none"
					strokeWidth="6"
					strokeLinecap="round"
					strokeDasharray={CIRCUMFERENCE}
					strokeDashoffset={CIRCUMFERENCE * (1 - shown)}
					className="stroke-primary transition-[stroke-dashoffset] duration-1000 ease-out motion-reduce:transition-none"
				/>
			</svg>
			<span className="text-sm font-semibold tabular-nums text-foreground">
				{Math.round(share * 100)}%
			</span>
		</span>
	);
}

export function MyRatingsHeader({
	totalCourses,
	ratedCourses,
	rateableLeft = 0,
}: Readonly<MyRatingsHeaderProps>) {
	let hint = "Усе оцінено, дякуємо";
	if (rateableLeft > 0) hint = `Ще ${rateableLeft} можна оцінити зараз`;
	else if (ratedCourses < totalCourses) hint = "Решта відкриється згодом";
	return (
		<div data-testid={testIds.myRatings.header}>
			<PageHeader
				title="Мої оцінки"
				description={
					totalCourses > 0 ? (
						<span className="mt-3 flex items-center gap-4">
							<ProgressRing share={ratedCourses / totalCourses} />
							<span className="flex flex-col">
								<span className="font-medium text-foreground tabular-nums">
									Оцінено {ratedCourses} з {totalCourses}
								</span>
								<span className="text-sm tabular-nums">{hint}</span>
							</span>
						</span>
					) : undefined
				}
			/>
		</div>
	);
}

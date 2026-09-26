import { useEffect, useState } from "react";

import { PageHeader } from "@/components/PageHeader";
import { testIds } from "@/lib/test-ids";

interface MyRatingsHeaderProps {
	totalCourses: number;
	ratedCourses: number;
	/** Unrated courses whose rating window is already open. */
	rateableLeft?: number;
}

function ProgressBar({ share }: Readonly<{ share: number }>) {
	// Starts empty and fills after the first paint so the bar sweeps in.
	const [shown, setShown] = useState(0);
	useEffect(() => {
		const frame = requestAnimationFrame(() => setShown(share));
		return () => cancelAnimationFrame(frame);
	}, [share]);

	return (
		<span
			className="mt-3 block h-1 w-xl max-w-full overflow-hidden rounded-full bg-muted"
			aria-hidden="true"
		>
			<span
				className="block h-full origin-left rounded-full bg-primary transition-transform duration-700 ease-out motion-reduce:transition-none"
				style={{ transform: `scaleX(${shown})` }}
			/>
		</span>
	);
}

export function MyRatingsHeader({
	totalCourses,
	ratedCourses,
	rateableLeft = 0,
}: Readonly<MyRatingsHeaderProps>) {
	let hint: string | undefined;
	if (rateableLeft > 0) hint = `ще ${rateableLeft} можна оцінити зараз`;
	else if (ratedCourses < totalCourses) hint = "решта відкриється згодом";
	return (
		<div data-testid={testIds.myRatings.header}>
			<PageHeader
				title="Мої оцінки"
				description={
					totalCourses > 0 ? (
						<>
							<span className="tabular-nums">
								Оцінено {ratedCourses} з {totalCourses}
								{hint ? `, ${hint}` : null}
							</span>
							<ProgressBar share={ratedCourses / totalCourses} />
						</>
					) : undefined
				}
			/>
		</div>
	);
}

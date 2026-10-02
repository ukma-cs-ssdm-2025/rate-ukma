import { useEffect, useState } from "react";

import { Link } from "@tanstack/react-router";
import { ListFilter } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { useRateFlow } from "@/features/rate-flow/useRateFlow";
import { testIds } from "@/lib/test-ids";
import { cn } from "@/lib/utils";

interface MyRatingsHeaderProps {
	totalCourses: number;
	ratedCourses: number;
	/** Unrated courses whose rating window is already open. */
	rateableLeft?: number;
	onlyUnrated?: boolean;
	onOnlyUnratedChange?: (next: boolean) => void;
	isLoading?: boolean;
}

export function ProgressBar({
	share,
	className,
}: Readonly<{ share: number; className?: string }>) {
	// Starts empty and fills after the first paint so the bar sweeps in.
	const [shown, setShown] = useState(0);
	useEffect(() => {
		const frame = requestAnimationFrame(() => setShown(share));
		return () => cancelAnimationFrame(frame);
	}, [share]);

	return (
		<span
			className={cn(
				"mt-3 block h-1 w-xl max-w-full overflow-hidden rounded-full bg-muted",
				className,
			)}
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
	onlyUnrated = false,
	onOnlyUnratedChange,
	isLoading = false,
}: Readonly<MyRatingsHeaderProps>) {
	const rateFlow = useRateFlow();
	// The «Лише неоцінені» button already counts what can be rated now.
	const hint =
		rateableLeft === 0 && ratedCourses < totalCourses
			? "решта відкриється згодом"
			: undefined;
	return (
		<div data-testid={testIds.myRatings.header}>
			<PageHeader
				title="Мої оцінки"
				actions={
					rateableLeft > 0 && onOnlyUnratedChange ? (
						<div className="flex flex-wrap items-center gap-2">
							<Button
								variant="outline"
								size="sm"
								aria-pressed={onlyUnrated}
								onClick={() => onOnlyUnratedChange(!onlyUnrated)}
								className="gap-1.5 aria-pressed:border-primary/30 aria-pressed:bg-primary/10 aria-pressed:text-primary"
							>
								<ListFilter className="size-4" aria-hidden />
								Лише неоцінені
								<span className="tabular-nums text-muted-foreground">
									{rateableLeft}
								</span>
							</Button>
							{rateFlow.enabled ? (
								<Button size="sm" asChild>
									<Link to="/rate">
										{ratedCourses > 0 ? "Оцінити решту" : "Оцінити дисципліни"}
									</Link>
								</Button>
							) : null}
						</div>
					) : undefined
				}
				description={
					isLoading ? (
						<>
							{/* A span: the description renders inside a paragraph. */}
							<span className="block h-6 w-28 animate-pulse rounded-md bg-accent" />
							<ProgressBar share={0} />
						</>
					) : totalCourses > 0 ? (
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

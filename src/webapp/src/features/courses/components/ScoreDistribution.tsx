import { cn } from "@/lib/utils";

/** Courses need this many ratings before a split says more than noise. */
export const MIN_SPLIT_RATINGS = 5;

/**
 * Five columns for scores 1..5. Pointing at one hands it to the card, which
 * says how many students gave that score, so the columns carry no labels.
 */
export function ScoreDistribution({
	counts,
	active,
	onActiveChange,
	className,
	label,
}: Readonly<{
	counts: number[];
	active: number | null;
	onActiveChange: (score: number | null) => void;
	className?: string;
	label: string;
}>) {
	const max = Math.max(...counts, 1);
	return (
		<div
			role="img"
			aria-label={`${label}: ${counts.map((c, i) => `${i + 1} — ${c}`).join(", ")}`}
			className={cn("flex shrink-0 items-end gap-1", className)}
			onPointerLeave={(e) => {
				if (e.pointerType === "mouse") onActiveChange(null);
			}}
		>
			{counts.map((count, i) => {
				const score = i + 1;
				return (
					<div
						key={score}
						className="flex h-full flex-1 items-end"
						onPointerEnter={() => onActiveChange(score)}
						onPointerDown={() => onActiveChange(score)}
					>
						<div
							className={cn(
								"w-full rounded-sm bg-current transition-opacity",
								active != null && active !== score && "opacity-30",
							)}
							style={{ height: `${Math.max(8, (count / max) * 100)}%` }}
						/>
					</div>
				);
			})}
		</div>
	);
}

import {
	formatDate,
	getDifficultyTone,
	getUsefulnessTone,
} from "@/features/courses/courseFormatting";
import type { RatingRead } from "@/lib/api/generated";
import { cn } from "@/lib/utils";

interface RatingCardProps {
	rating: RatingRead;
}

export function RatingCard({ rating }: Readonly<RatingCardProps>) {
	const displayName = rating.is_anonymous
		? "Анонімний відгук"
		: rating.student_name || "Студент";
	const difficultyValue = rating.difficulty?.toFixed(1) ?? "—";
	const usefulnessValue = rating.usefulness?.toFixed(1) ?? "—";

	return (
		<article className="py-4">
			<div className="flex flex-wrap items-start justify-between gap-3 mb-2">
				<div className="flex items-center gap-2 text-xs text-muted-foreground">
					<span className="font-medium">{displayName}</span>
					{rating.created_at && (
						<>
							<span className="text-muted-foreground/40">•</span>
							<time>{formatDate(rating.created_at)}</time>
						</>
					)}
				</div>
				<div className="flex items-center gap-2 text-xs">
					<span className="text-muted-foreground">Складність:</span>
					<span
						className={cn(
							"font-semibold tabular-nums",
							getDifficultyTone(rating.difficulty),
						)}
					>
						{difficultyValue}
					</span>
					<span className="text-muted-foreground/40">•</span>
					<span className="text-muted-foreground">Корисність:</span>
					<span
						className={cn(
							"font-semibold tabular-nums",
							getUsefulnessTone(rating.usefulness),
						)}
					>
						{usefulnessValue}
					</span>
				</div>
			</div>

			{rating.comment ? (
				<p className="text-sm leading-relaxed text-foreground/90">
					{rating.comment}
				</p>
			) : (
				<p className="text-xs italic text-muted-foreground/60">
					Студент не залишив коментар.
				</p>
			)}
		</article>
	);
}

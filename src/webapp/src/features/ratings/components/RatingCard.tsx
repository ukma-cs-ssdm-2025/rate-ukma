import { formatDate } from "@/features/courses/courseFormatting";
import type { RatingRead } from "@/lib/api/generated";
import { RatingComment } from "./RatingComment";
import { RatingStats } from "./RatingStats";

interface RatingCardProps {
	rating: RatingRead;
}

export function RatingCard({ rating }: Readonly<RatingCardProps>) {
	const displayName = rating.is_anonymous
		? "Анонімний відгук"
		: rating.student_name || "Студент";

	return (
		<article className="py-4 px-4">
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
				<RatingStats
					difficulty={rating.difficulty}
					usefulness={rating.usefulness}
				/>
			</div>

			<RatingComment comment={rating.comment} />
		</article>
	);
}

import { User } from "lucide-react";

import {
	formatDate,
	getDifficultyTone,
	getUsefulnessTone,
} from "@/features/courses/courseFormatting";
import type { RatingRead } from "@/lib/api/generated";

interface RatingCardProps {
	rating: RatingRead;
}

export function RatingCard({ rating }: RatingCardProps) {
	return (
		<div className="p-4 rounded-lg border bg-card space-y-3">
			<div className="flex items-start justify-between">
				<div className="flex items-center gap-2">
					<User className="h-4 w-4 text-muted-foreground" />
					<span className="font-medium">
						{rating.is_anonymous
							? "Анонімний студент"
							: rating.student_name || "Студент"}
					</span>
				</div>
				{rating.created_at && (
					<span className="text-xs text-muted-foreground">
						{formatDate(rating.created_at)}
					</span>
				)}
			</div>

			<div className="flex gap-4">
				<div className="flex items-center gap-1">
					<span className="text-xs text-muted-foreground">Складність:</span>
					<span
						className={`font-semibold ${getDifficultyTone(rating.difficulty)}`}
					>
						{rating.difficulty?.toFixed(1)}
					</span>
				</div>
				<div className="flex items-center gap-1">
					<span className="text-xs text-muted-foreground">Корисність:</span>
					<span
						className={`font-semibold ${getUsefulnessTone(rating.usefulness)}`}
					>
						{rating.usefulness?.toFixed(1)}
					</span>
				</div>
			</div>

			{rating.comment && (
				<p className="text-sm text-muted-foreground leading-relaxed">
					{rating.comment}
				</p>
			)}
		</div>
	);
}

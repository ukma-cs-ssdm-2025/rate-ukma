import { useState } from "react";

import { Link } from "@tanstack/react-router";
import { MessageSquareMore, Star } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface RatingCommentDisplayProps {
	comment?: string;
	hasRating: boolean;
	courseId?: string;
}

export function RatingCommentDisplay({
	comment,
	hasRating,
	courseId,
}: Readonly<RatingCommentDisplayProps>) {
	const [isExpanded, setIsExpanded] = useState(false);

	if (!comment) {
		if (hasRating) {
			return (
				<p className="text-xs text-muted-foreground/80">Коментар відсутній.</p>
			);
		}

		return (
			<div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
				<span>Ви ще не оцінили цей курс.</span>
				{courseId ? (
					<Button variant="default" size="sm" asChild>
						<Link to="/courses/$courseId" params={{ courseId }}>
							<Star className="h-3.5 w-3.5" />
							<span className="ml-1">Залишити відгук</span>
						</Link>
					</Button>
				) : null}
			</div>
		);
	}

	return (
		<div className="text-sm text-foreground/90">
			<div className="flex gap-2">
				<div className="mt-0.5 text-muted-foreground">
					<MessageSquareMore className="h-3.5 w-3.5" />
				</div>
				<div className="flex-1">
					<p className={cn("leading-relaxed", !isExpanded && "line-clamp-3")}>
						{comment}
					</p>
					{comment.length > 150 ? (
						<button
							type="button"
							onClick={() => setIsExpanded(!isExpanded)}
							className="mt-1 text-xs text-primary hover:underline"
						>
							{isExpanded ? "Згорнути" : "Читати далі"}
						</button>
					) : null}
				</div>
			</div>
		</div>
	);
}

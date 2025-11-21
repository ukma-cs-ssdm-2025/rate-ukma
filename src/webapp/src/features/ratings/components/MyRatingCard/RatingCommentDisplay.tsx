import { useState } from "react";

import { Link } from "@tanstack/react-router";
import { MessageSquareMore, Star } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface RatingCommentDisplayProps {
	comment?: string;
	hasRating: boolean;
	courseId?: string;
	canRate?: boolean;
}

export function RatingCommentDisplay({
	comment,
	hasRating,
	courseId,
	canRate = true,
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
					canRate ? (
						<Button variant="default" size="sm" asChild>
							<Link to="/courses/$courseId" params={{ courseId }}>
								<Star className="h-3.5 w-3.5" />
								<span className="ml-1">Залишити відгук</span>
							</Link>
						</Button>
					) : (
						<div className="relative inline-block group">
							<Button
								variant="secondary"
								size="sm"
								disabled
								className="cursor-not-allowed opacity-10 bg-gray-300"
							>
								<Star className="h-3.5 w-3.5" />
								<span className="ml-1">Залишити відгук</span>
							</Button>
							<div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap pointer-events-none z-10">
								Ви не можете оцінити курс, не послухавши його
								<div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></div>
							</div>
						</div>
					)
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

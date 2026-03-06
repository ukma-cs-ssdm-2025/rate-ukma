import { useId, useState } from "react";

import { Button } from "@/components/ui/Button";

interface RatingCommentProps {
	readonly comment: string | null | undefined;
	readonly emptyMessage?: string;
}

const COMMENT_PREVIEW_LENGTH = 280;

export function RatingComment({
	comment,
	emptyMessage = "Студент не лишив коментар.",
}: RatingCommentProps) {
	const [isExpanded, setIsExpanded] = useState(false);
	const commentId = useId();

	if (comment) {
		const formattedComment = comment.replaceAll(/\n{4,}/g, "\n\n\n");
		const isLongComment = formattedComment.length > COMMENT_PREVIEW_LENGTH;
		return (
			<div className="space-y-2">
				<p
					id={commentId}
					className={
						isExpanded
							? "text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap"
							: "text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap line-clamp-4"
					}
				>
					{formattedComment}
				</p>
				{isLongComment && (
					<Button
						type="button"
						variant="link"
						size="sm"
						className="h-auto p-0 text-sm font-semibold"
						aria-expanded={isExpanded}
						aria-controls={commentId}
						onClick={() => setIsExpanded((current) => !current)}
					>
						{isExpanded ? "Менше" : "Читати далі"}
					</Button>
				)}
			</div>
		);
	}

	return (
		<p className="text-xs italic text-muted-foreground/60">{emptyMessage}</p>
	);
}

interface RatingCommentProps {
	readonly comment: string | null | undefined;
	readonly emptyMessage?: string;
}

export function RatingComment({
	comment,
	emptyMessage = "Студент не лишив коментар.",
}: RatingCommentProps) {
	if (comment) {
		const formattedComment = comment.replaceAll(/\n{4,}/g, "\n\n\n");
		return (
			<p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
				{formattedComment}
			</p>
		);
	}

	return (
		<p className="text-xs italic text-muted-foreground/60">{emptyMessage}</p>
	);
}

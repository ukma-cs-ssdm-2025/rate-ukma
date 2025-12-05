interface RatingCommentProps {
	readonly comment: string | null | undefined;
	readonly emptyMessage?: string;
}

export function RatingComment({
	comment,
	emptyMessage = "Студент не лишив коментар.",
}: RatingCommentProps) {
	if (comment) {
		return (
			<p className="text-sm leading-relaxed text-foreground/90">{comment}</p>
		);
	}

	return (
		<p className="text-xs italic text-muted-foreground/60">{emptyMessage}</p>
	);
}

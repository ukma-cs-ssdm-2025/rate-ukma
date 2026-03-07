import { ExpandableText } from "@/components/ui/ExpandableText";

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
			<ExpandableText className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
				{formattedComment}
			</ExpandableText>
		);
	}

	return (
		<p className="text-xs italic text-muted-foreground/60">{emptyMessage}</p>
	);
}

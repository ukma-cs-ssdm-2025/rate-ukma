import { Link } from "@tanstack/react-router";

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/Dialog";
import { formatRelativeTime } from "@/features/notifications/notificationFormatting";
import { testIds } from "@/lib/test-ids";
import type { FeedCommentItem } from "../feedTypes";

interface FeedCommentDialogProps {
	readonly item: FeedCommentItem;
	readonly open: boolean;
	readonly onOpenChange: (open: boolean) => void;
}

export function FeedCommentDialog({
	item,
	open,
	onOpenChange,
}: Readonly<FeedCommentDialogProps>) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="max-h-[85vh] overflow-y-auto sm:max-w-2xl"
				data-testid={testIds.feed.commentDialog}
			>
				<DialogHeader>
					<DialogTitle className="leading-tight tracking-tight">
						<Link
							to="/courses/$courseId"
							params={{ courseId: item.courseId }}
							className="underline-offset-4 transition-colors hover:text-primary hover:underline"
						>
							{item.courseTitle}
						</Link>
					</DialogTitle>
				</DialogHeader>

				<DialogDescription asChild>
					<p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
						{item.content}
					</p>
				</DialogDescription>

				<div className="flex items-center gap-2 pt-2 text-xs text-muted-foreground">
					<time>{formatRelativeTime(item.createdAt)}</time>
				</div>
			</DialogContent>
		</Dialog>
	);
}

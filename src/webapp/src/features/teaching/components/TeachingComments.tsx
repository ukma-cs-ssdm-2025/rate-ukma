import { MessageSquare } from "lucide-react";

import { SectionHeader } from "@/components/SectionHeader";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import {
	Empty,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/Empty";
import { ExpandableText } from "@/components/ui/ExpandableText";
import { formatDate } from "@/features/courses/courseFormatting";
import { RatingStats } from "@/features/ratings/components/RatingStats";
import type { TeachingComment } from "../types";

/** Students' free-text answers, without names: teachers never see who wrote what. */
export function TeachingComments({
	comments,
}: Readonly<{ comments: readonly TeachingComment[] }>) {
	return (
		<section className="space-y-3">
			<SectionHeader
				title="Коментарі"
				meta={
					comments.length > 0 ? (
						<Badge variant="secondary" className="tabular-nums">
							{comments.length}
						</Badge>
					) : null
				}
			/>
			{comments.length === 0 ? (
				<Empty className="border py-10">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<MessageSquare />
						</EmptyMedia>
						<EmptyTitle>Коментарів поки немає</EmptyTitle>
					</EmptyHeader>
				</Empty>
			) : (
				<ul className="space-y-3">
					{comments.map((comment) => (
						<li key={comment.id}>
							<Card className="shadow-sm">
								<CardContent className="space-y-3 p-4 sm:p-5">
									<div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
										<time
											dateTime={comment.created_at}
											className="text-sm text-muted-foreground"
										>
											{formatDate(comment.created_at)}
										</time>
										<RatingStats
											difficulty={comment.difficulty}
											usefulness={comment.usefulness}
										/>
									</div>
									<ExpandableText className="text-sm leading-relaxed">
										{comment.text}
									</ExpandableText>
								</CardContent>
							</Card>
						</li>
					))}
				</ul>
			)}
		</section>
	);
}

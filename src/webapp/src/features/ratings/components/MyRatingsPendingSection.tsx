import { Link } from "@tanstack/react-router";

import { SectionHeader } from "@/components/SectionHeader";
import { TermBadge } from "@/components/TermBadge";
import { RatingButton } from "@/features/ratings/components/RatingButton";
import type { StudentRatingsDetailed } from "@/lib/api/generated";
import { testIds } from "@/lib/test-ids";

interface MyRatingsPendingSectionProps {
	items: StudentRatingsDetailed[];
}

export function MyRatingsPendingSection({
	items,
}: Readonly<MyRatingsPendingSectionProps>) {
	if (items.length === 0) return null;

	return (
		<section aria-label="Чекають на оцінку" className="space-y-1">
			<SectionHeader title="Чекають на оцінку" />
			<div className="divide-y divide-border/30">
				{items.map((course, index) => (
					<div
						key={
							course.course_offering_id ??
							course.course_id ??
							`pending-${index}`
						}
						className="flex items-center gap-3 py-3"
					>
						<div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
							{course.course_id ? (
								<Link
									to="/courses/$courseId"
									params={{ courseId: course.course_id }}
									className="truncate font-medium text-foreground underline-offset-4 decoration-dotted hover:underline"
								>
									{course.course_title ?? "Курс"}
								</Link>
							) : (
								<span className="truncate font-medium text-foreground">
									{course.course_title ?? "Курс"}
								</span>
							)}
							{course.semester?.season && (
								<TermBadge term={course.semester.season} />
							)}
						</div>
						{course.course_id ? (
							<RatingButton canRate size="sm" asChild>
								<Link
									to="/courses/$courseId"
									params={{ courseId: course.course_id }}
									search={{ openRating: true }}
									data-testid={testIds.myRatings.leaveReviewLink}
								>
									Оцінити
								</Link>
							</RatingButton>
						) : null}
					</div>
				))}
			</div>
		</section>
	);
}

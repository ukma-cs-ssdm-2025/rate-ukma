import * as React from "react";

import { createFileRoute } from "@tanstack/react-router";

import Layout from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { CourseOfferingsDropdown } from "@/features/course-offerings/components/CourseOfferingsDropdown";
import {
	CourseDetailsHeader,
	CourseDetailsHeaderSkeleton,
} from "@/features/courses/components/CourseDetailsHeader";
import {
	CourseStatsCards,
	CourseStatsCardsSkeleton,
} from "@/features/courses/components/CourseStatsCards";
import {
	CourseRatingsList,
	CourseRatingsListSkeleton,
} from "@/features/ratings/components/CourseRatingsList";
import { DeleteRatingDialog } from "@/features/ratings/components/DeleteRatingDialog";
import { RatingButton } from "@/features/ratings/components/RatingButton";
import { RatingModal } from "@/features/ratings/components/RatingModal";
import { useUserCourseRating } from "@/features/ratings/hooks/useUserCourseRating";
import {
	useCoursesOfferingsList,
	useCoursesRetrieve,
} from "@/lib/api/generated";
import { withAuth } from "@/lib/auth";

function CourseDetailsRoute() {
	const { courseId } = Route.useParams();
	const {
		data: course,
		isLoading: isCourseLoading,
		isError: isCourseError,
	} = useCoursesRetrieve(courseId);

	const {
		data: courseOfferings,
		isLoading: isOfferingsLoading,
		isError: isOfferingsError,
	} = useCoursesOfferingsList(courseId);

	const [isRatingModalOpen, setIsRatingModalOpen] = React.useState(false);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);

	const {
		rating: userRating,
		ratingId,
		ratedOffering,
		hasAttendedCourse,
		selectedOffering,
		attendedCourseId,
		isLoading: isUserRatingLoading,
	} = useUserCourseRating(courseId);

	if (isCourseLoading || isUserRatingLoading || isOfferingsLoading) {
		return (
			<Layout>
				<CourseDetailsSkeleton />
			</Layout>
		);
	}

	if (isCourseError || isOfferingsError || !course || !courseOfferings) {
		return (
			<Layout>
				<div className="space-y-6">
					<Card className="border-destructive">
						<CardContent className="pt-6">
							<p className="text-center text-muted-foreground">
								Не вдалося завантажити інформацію про курс
							</p>
						</CardContent>
					</Card>
				</div>
			</Layout>
		);
	}

	return (
		<Layout>
			<div className="space-y-8 pb-12">
				<div className="space-y-6">
					<div className="flex items-center justify-between">
						<CourseDetailsHeader
							title={course.title ?? ""}
							status={course.status ?? ""}
							specialities={course.specialities ?? []}
							departmentName={course.department_name ?? ""}
						/>

						<CourseOfferingsDropdown
							courseOfferings={courseOfferings?.course_offerings ?? []}
						/>
					</div>

					{course.description && (
						<p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">
							{course.description}
						</p>
					)}
				</div>

				<CourseStatsCards
					difficulty={course.avg_difficulty ?? null}
					usefulness={course.avg_usefulness ?? null}
					ratingsCount={course.ratings_count ?? null}
				/>

				{hasAttendedCourse && selectedOffering && !ratedOffering && (
					<div className="flex justify-center">
						<RatingButton
							canRate={selectedOffering.can_rate ?? true}
							onClick={() => setIsRatingModalOpen(true)}
						>
							Оцінити цей курс
						</RatingButton>
					</div>
				)}

				<CourseRatingsList
					courseId={courseId}
					userRating={userRating}
					onEditUserRating={() => setIsRatingModalOpen(true)}
					onDeleteUserRating={() => setIsDeleteDialogOpen(true)}
				/>
			</div>

			{selectedOffering?.id && attendedCourseId && (
				<RatingModal
					isOpen={isRatingModalOpen}
					onClose={() => setIsRatingModalOpen(false)}
					courseId={attendedCourseId}
					offeringId={selectedOffering.id}
					courseName={course.title}
					existingRating={ratedOffering?.rated || null}
				/>
			)}

			{ratingId && attendedCourseId && (
				<DeleteRatingDialog
					courseId={courseId}
					ratingId={ratingId}
					open={isDeleteDialogOpen}
					onOpenChange={setIsDeleteDialogOpen}
				/>
			)}
		</Layout>
	);
}

function CourseDetailsSkeleton() {
	return (
		<div className="space-y-8 pb-12">
			<div className="space-y-6">
				<CourseDetailsHeaderSkeleton />
				<Skeleton className="h-12 w-full max-w-3xl" />
			</div>

			<CourseStatsCardsSkeleton />

			<CourseRatingsListSkeleton />
		</div>
	);
}

export const Route = createFileRoute("/courses/$courseId")({
	component: withAuth(CourseDetailsRoute),
});

import * as React from "react";

import { createFileRoute } from "@tanstack/react-router";

import Layout from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import {
	CourseCazYearsSection,
	getLatestOfferingMeta,
} from "@/features/course-offerings/components/CourseCazYearsSection";
import {
	CourseDetailsHeader,
	CourseDetailsHeaderSkeleton,
} from "@/features/courses/components/CourseDetailsHeader";
import {
	CourseStatsHero,
	CourseStatsHeroSkeleton,
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

function CourseDescription({ text }: Readonly<{ text: string }>) {
	const [expanded, setExpanded] = React.useState(false);
	const [clamped, setClamped] = React.useState(false);

	const measureRef = React.useCallback((el: HTMLParagraphElement | null) => {
		if (el) setClamped(el.scrollHeight > el.clientHeight);
	}, []);

	return (
		<div>
			<p
				ref={measureRef}
				className={`text-[15px] leading-relaxed text-muted-foreground ${
					expanded ? "" : "line-clamp-4"
				}`}
			>
				{text}
			</p>
			{clamped && (
				<button
					type="button"
					onClick={() => setExpanded((v) => !v)}
					className="mt-1.5 rounded-full bg-muted px-3 py-0.5 text-sm text-muted-foreground hover:bg-muted/80 transition-colors"
				>
					{expanded ? "Згорнути" : "Читати далі"}
				</button>
			)}
		</div>
	);
}

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

	const offerings = courseOfferings?.course_offerings ?? [];
	const metaBadges = React.useMemo(
		() => getLatestOfferingMeta(offerings),
		[offerings],
	);

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
				<div className="space-y-4">
					<CourseDetailsHeader
						title={course.title ?? ""}
						specialities={course.specialities ?? []}
						departmentName={course.department_name ?? ""}
						offeringBadges={metaBadges}
						cazButton={
							offerings.length > 0 ? (
								<CourseCazYearsSection courseOfferings={offerings} />
							) : undefined
						}
					/>

					{course.description && (
						<CourseDescription text={course.description} />
					)}

					<CourseStatsHero
						difficulty={course.avg_difficulty ?? null}
						usefulness={course.avg_usefulness ?? null}
						ratingsCount={course.ratings_count ?? null}
					/>
				</div>

				{hasAttendedCourse && selectedOffering && !ratedOffering && (
					<div className="flex justify-center">
						<RatingButton
							canRate={Boolean(selectedOffering.can_rate)}
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
					canVote={hasAttendedCourse && Boolean(selectedOffering?.can_rate)}
					hasAttended={hasAttendedCourse}
					canRate={Boolean(selectedOffering?.can_rate)}
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

			<CourseStatsHeroSkeleton />

			<CourseRatingsListSkeleton />
		</div>
	);
}

export const Route = createFileRoute("/courses/$courseId")({
	component: withAuth(CourseDetailsRoute),
});

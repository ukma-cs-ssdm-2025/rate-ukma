import * as React from "react";

import { createFileRoute } from "@tanstack/react-router";
import { Helmet } from "react-helmet-async";

import Layout from "@/components/Layout";
import { ExpandableText } from "@/components/ui/ExpandableText";
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
import { RatingModal } from "@/features/ratings/components/RatingModal";
import { useUserCourseRating } from "@/features/ratings/hooks/useUserCourseRating";
import {
	useCoursesOfferingsList,
	useCoursesRetrieve,
} from "@/lib/api/generated";
import { formatPageTitle } from "@/lib/app-metadata";
import { withAuth } from "@/lib/auth";

function CourseDescription({ text }: Readonly<{ text: string }>) {
	return (
		<ExpandableText className="text-[15px] leading-relaxed text-muted-foreground">
			{text}
		</ExpandableText>
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
				<div className="py-16 text-center" role="alert">
					<p className="text-muted-foreground">
						Не вдалося завантажити інформацію про курс
					</p>
				</div>
			</Layout>
		);
	}

	const offerings = courseOfferings?.course_offerings ?? [];
	const canShowCta = hasAttendedCourse && selectedOffering && !ratedOffering;
	const offeringMeta =
		offerings.length > 0 ? getLatestOfferingMeta(offerings) : null;

	return (
		<Layout>
			{course.title && (
				<Helmet>
					<title>{formatPageTitle(course.title)}</title>
				</Helmet>
			)}
			<div className="pb-16">
				{/* Hero zone: title → meta → badges + offering facts → scores */}
				<div className="space-y-6">
					<CourseDetailsHeader
						title={course.title ?? ""}
						specialities={course.specialities ?? []}
						departmentName={course.department_name ?? ""}
						facultyName={course.faculty_name ?? ""}
						offeringBadges={offeringMeta ?? undefined}
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

				{/* Reviews — CTA is anchored here */}
				<div className="mt-12">
					<CourseRatingsList
						courseId={courseId}
						userRating={userRating}
						onEditUserRating={() => setIsRatingModalOpen(true)}
						onDeleteUserRating={() => setIsDeleteDialogOpen(true)}
						canVote={hasAttendedCourse && Boolean(selectedOffering?.can_rate)}
						hasAttended={hasAttendedCourse}
						canRate={Boolean(selectedOffering?.can_rate)}
						showCta={Boolean(canShowCta)}
						canRateButton={Boolean(selectedOffering?.can_rate)}
						onRate={() => setIsRatingModalOpen(true)}
					/>
				</div>
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
		<div className="pb-16">
			<div className="space-y-6">
				<CourseDetailsHeaderSkeleton />
				<Skeleton className="h-10 w-full max-w-2xl" />
				<CourseStatsHeroSkeleton />
			</div>
			<div className="mt-12">
				<CourseRatingsListSkeleton />
			</div>
		</div>
	);
}

export const Route = createFileRoute("/courses/$courseId")({
	component: withAuth(CourseDetailsRoute),
});

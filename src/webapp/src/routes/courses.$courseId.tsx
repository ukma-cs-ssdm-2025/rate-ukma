import * as React from "react";

import { createFileRoute } from "@tanstack/react-router";
import { Helmet } from "react-helmet-async";

import Layout from "@/components/Layout";
import { ErrorState } from "@/components/ui/ErrorState";
import { ExpandableText } from "@/components/ui/ExpandableText";
import {
	CourseCazCard,
	getLatestOfferingLoads,
	runsInOneTerm,
} from "@/features/course-offerings/components/CourseCazCard";
import {
	CourseDetailsHeader,
	CourseDetailsHeaderSkeleton,
} from "@/features/courses/components/CourseDetailsHeader";
import {
	CourseStatsHero,
	CourseStatsHeroSkeleton,
} from "@/features/courses/components/CourseStatsCards";
import { hasCourseScores } from "@/features/courses/courseFormatting";
import {
	CourseRatingsList,
	CourseRatingsListSkeleton,
} from "@/features/ratings/components/CourseRatingsList";
import { DeleteRatingDialog } from "@/features/ratings/components/DeleteRatingDialog";
import { RatingModal } from "@/features/ratings/components/RatingModal";
import { RatingButton } from "@/features/ratings/components/RatingButton";
import { useUserCourseRating } from "@/features/ratings/hooks/useUserCourseRating";
import {
	useCoursesOfferingsList,
	useCoursesRetrieve,
} from "@/lib/api/generated";
import { buildCourseOgDescription, formatPageTitle } from "@/lib/app-metadata";
import { withAuth } from "@/lib/auth";

function CourseDescription({ text }: Readonly<{ text: string }>) {
	return (
		<ExpandableText className="max-w-3xl text-base leading-relaxed text-muted-foreground">
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
				<ErrorState
					title="Не вдалося завантажити інформацію про курс"
					role="alert"
				/>
			</Layout>
		);
	}

	const offerings = courseOfferings?.course_offerings ?? [];
	const canShowCta = hasAttendedCourse && selectedOffering && !ratedOffering;
	const termLoads =
		offerings.length > 0 ? getLatestOfferingLoads(offerings) : [];
	const showStats = hasCourseScores(
		course.avg_difficulty ?? null,
		course.avg_usefulness ?? null,
		course.ratings_count ?? null,
	);
	const rateAction = canShowCta ? (
		<RatingButton
			canRate={Boolean(selectedOffering?.can_rate)}
			onClick={() => setIsRatingModalOpen(true)}
			size="default"
		>
			Оцінити цей курс
		</RatingButton>
	) : null;
	const canonicalUrl = `${window.location.origin + window.location.pathname}`;
	const ogDescription = buildCourseOgDescription(course);

	return (
		<Layout>
			{course.title && (
				<Helmet>
					<title>{formatPageTitle(course.title)}</title>
					<meta property="og:title" content={formatPageTitle(course.title)} />
					<meta property="og:description" content={ogDescription} />
					<meta property="og:url" content={canonicalUrl} />
					<meta property="og:type" content="website" />
					<meta name="twitter:title" content={formatPageTitle(course.title)} />
					<meta name="twitter:description" content={ogDescription} />
				</Helmet>
			)}
			<div className="space-y-8 pb-16">
				<CourseDetailsHeader
					title={course.title ?? ""}
					educationLevel={course.education_level}
					specialities={course.specialities ?? []}
					departmentName={course.department_name ?? ""}
					facultyName={course.faculty_name ?? ""}
					termLoads={termLoads}
				/>

				<div className="grid items-start gap-3 sm:gap-4 lg:grid-cols-3">
					{(showStats || rateAction) && (
						<div className="space-y-3 lg:col-span-2">
							{showStats && (
								<CourseStatsHero
									difficulty={course.avg_difficulty ?? null}
									usefulness={course.avg_usefulness ?? null}
									ratingsCount={course.ratings_count ?? null}
									action={rateAction}
								/>
							)}
							{!showStats && rateAction}
						</div>
					)}
					{offerings.length > 0 && (
						<CourseCazCard courseOfferings={offerings} />
					)}
				</div>

				{course.description && <CourseDescription text={course.description} />}

				<CourseRatingsList
					courseId={courseId}
					userRating={userRating}
					onEditUserRating={() => setIsRatingModalOpen(true)}
					onDeleteUserRating={() => setIsDeleteDialogOpen(true)}
					hasAttended={hasAttendedCourse}
					canRate={Boolean(selectedOffering?.can_rate)}
					// The page renders the single rate CTA next to the scores, so the list must not render its own.
					showCta={false}
					canRateButton={Boolean(selectedOffering?.can_rate)}
					onRate={() => setIsRatingModalOpen(true)}
					singleTerm={runsInOneTerm(offerings)}
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
		<div className="space-y-8 pb-16">
			<CourseDetailsHeaderSkeleton />
			<CourseStatsHeroSkeleton />
			<CourseRatingsListSkeleton />
		</div>
	);
}

export const Route = createFileRoute("/courses/$courseId")({
	component: withAuth(CourseDetailsRoute),
});

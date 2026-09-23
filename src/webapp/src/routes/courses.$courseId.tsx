import * as React from "react";

import { createFileRoute } from "@tanstack/react-router";
import { Helmet } from "react-helmet-async";

import Layout from "@/components/Layout";
import { ErrorState } from "@/components/ui/ErrorState";
import { ExpandableText } from "@/components/ui/ExpandableText";
import { Skeleton } from "@/components/ui/Skeleton";
import {
	CourseCazYearsSection,
	getLatestOfferingTerms,
} from "@/features/course-offerings/components/CourseCazYearsSection";
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
				<ErrorState
					title="Не вдалося завантажити інформацію про курс"
					role="alert"
				/>
			</Layout>
		);
	}

	const offerings = courseOfferings?.course_offerings ?? [];
	const canShowCta = hasAttendedCourse && selectedOffering && !ratedOffering;
	const headerTerms =
		offerings.length > 0 ? getLatestOfferingTerms(offerings) : [];
	const showStats = hasCourseScores(
		course.avg_difficulty ?? null,
		course.avg_usefulness ?? null,
		course.ratings_count ?? null,
	);
	const showAside = offerings.length > 0 || Boolean(canShowCta) || showStats;
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
			<div className="grid gap-8 pb-16 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
				<CourseDetailsHeader
					title={course.title ?? ""}
					educationLevel={course.education_level}
					specialities={course.specialities ?? []}
					departmentName={course.department_name ?? ""}
					facultyName={course.faculty_name ?? ""}
					terms={headerTerms}
				/>

				{showAside && (
					<aside className="min-w-0 space-y-4 lg:sticky lg:top-20 lg:row-span-2">
						<CourseStatsHero
							difficulty={course.avg_difficulty ?? null}
							usefulness={course.avg_usefulness ?? null}
							ratingsCount={course.ratings_count ?? null}
						/>
						{canShowCta && (
							<RatingButton
								canRate={Boolean(selectedOffering?.can_rate)}
								onClick={() => setIsRatingModalOpen(true)}
								size="lg"
							>
								Оцінити цей курс
							</RatingButton>
						)}
						{offerings.length > 0 && (
							<CourseCazYearsSection courseOfferings={offerings} />
						)}
					</aside>
				)}

				<div className="min-w-0 space-y-8">
					{course.description && (
						<CourseDescription text={course.description} />
					)}

					<CourseRatingsList
						courseId={courseId}
						userRating={userRating}
						onEditUserRating={() => setIsRatingModalOpen(true)}
						onDeleteUserRating={() => setIsDeleteDialogOpen(true)}
						hasAttended={hasAttendedCourse}
						canRate={Boolean(selectedOffering?.can_rate)}
						// The aside owns the single rate CTA, so the list must not render its own.
						showCta={false}
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
		<div className="grid gap-8 pb-16 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
			<CourseDetailsHeaderSkeleton />
			<div className="min-w-0 lg:row-span-2">
				<CourseStatsHeroSkeleton />
			</div>
			<div className="min-w-0 space-y-8">
				<Skeleton className="h-10 w-full max-w-2xl" />
				<CourseRatingsListSkeleton />
			</div>
		</div>
	);
}

export const Route = createFileRoute("/courses/$courseId")({
	component: withAuth(CourseDetailsRoute),
});

import * as React from "react";

import { createFileRoute } from "@tanstack/react-router";
import { Helmet } from "react-helmet-async";

import Layout from "@/components/Layout";
import { ErrorState } from "@/components/ui/ErrorState";
import {
	CourseAbout,
	offeringLoad,
} from "@/features/course-offerings/components/CourseAbout";
import {
	getLatestOffering,
	getLatestOfferingTerms,
	runsInOneTerm,
} from "@/features/course-offerings/components/CourseCazRecords";
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
import { CANNOT_RATE_TOOLTIP_TEXT } from "@/features/ratings/definitions/ratingDefinitions";
import { useUserCourseRating } from "@/features/ratings/hooks/useUserCourseRating";
import {
	useCoursesOfferingsList,
	useCoursesRetrieve,
} from "@/lib/api/generated";
import { buildCourseOgDescription, formatPageTitle } from "@/lib/app-metadata";
import { withAuth } from "@/lib/auth";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";

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
	const isDesktop = useMediaQuery("(min-width: 1024px)");

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
	const canRateNow = Boolean(selectedOffering?.can_rate);
	const latestOffering = getLatestOffering(offerings);
	const terms = getLatestOfferingTerms(offerings);
	const load = offeringLoad(latestOffering);
	const showStats = hasCourseScores(
		course.avg_difficulty ?? null,
		course.avg_usefulness ?? null,
		course.ratings_count ?? null,
	);
	// Attendees who have not rated yet see where they stand: rateable now or after midterm.
	const rateAction =
		!ratedOffering && hasAttendedCourse && selectedOffering ? (
			<div className="flex flex-col gap-3 rounded-xl bg-card-user p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
				<div className="min-w-0 space-y-0.5">
					<p className="font-medium">Ви слухали цей курс</p>
					<p className="text-sm text-muted-foreground">
						{canRateNow
							? "Ваша оцінка допоможе іншим обрати"
							: CANNOT_RATE_TOOLTIP_TEXT}
					</p>
				</div>
				<RatingButton
					canRate={canRateNow}
					onClick={() => setIsRatingModalOpen(true)}
				>
					Оцінити курс
				</RatingButton>
			</div>
		) : null;
	const about = (
		<CourseAbout
			description={course.description}
			latestOffering={latestOffering}
			courseOfferings={offerings}
		/>
	);
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
				<div className="grid gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_320px]">
					<div className="min-w-0 space-y-8">
						<CourseDetailsHeader
							title={course.title ?? ""}
							educationLevel={course.education_level}
							specialities={course.specialities ?? []}
							departmentName={course.department_name ?? ""}
							facultyName={course.faculty_name ?? ""}
							terms={terms}
							credits={load.credits}
							weeklyHours={load.weeklyHours}
						/>

						{showStats ? (
							<CourseStatsHero
								difficulty={course.avg_difficulty ?? null}
								usefulness={course.avg_usefulness ?? null}
								ratingsCount={course.ratings_count ?? null}
							/>
						) : null}

						{/* Phones read one column: scores and the call to rate, then «Про курс»,
						    then reviews. Rendered once: the rate button's test id must stay unique. */}
						{isDesktop ? null : rateAction}
						{isDesktop ? null : about}

						<CourseRatingsList
							courseId={courseId}
							userRating={userRating}
							onEditUserRating={() => setIsRatingModalOpen(true)}
							onDeleteUserRating={() => setIsDeleteDialogOpen(true)}
							rateAction={isDesktop ? rateAction : null}
							hasAttended={hasAttendedCourse}
							canRate={canRateNow}
							singleTerm={runsInOneTerm(offerings)}
						/>
					</div>

					{isDesktop ? (
						<aside className="min-w-0">
							<div className="lg:sticky lg:top-24">{about}</div>
						</aside>
					) : null}
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

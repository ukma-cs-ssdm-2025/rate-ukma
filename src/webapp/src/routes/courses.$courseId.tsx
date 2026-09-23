import * as React from "react";

import { createFileRoute } from "@tanstack/react-router";
import { CircleCheck } from "lucide-react";
import { Helmet } from "react-helmet-async";

import Layout from "@/components/Layout";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { CourseAbout } from "@/features/course-offerings/components/CourseAbout";
import {
	getLatestOffering,
	getLatestOfferingLoads,
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
	const canRateNow = Boolean(selectedOffering?.can_rate);
	const latestOffering = getLatestOffering(offerings);
	const termLoads =
		offerings.length > 0 ? getLatestOfferingLoads(offerings) : [];
	const showStats = hasCourseScores(
		course.avg_difficulty ?? null,
		course.avg_usefulness ?? null,
		course.ratings_count ?? null,
	);
	// Attendees always see where they stand: rated, rateable, or waiting for midterm.
	let rateAction: React.ReactNode = null;
	if (ratedOffering) {
		rateAction = (
			<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
				<span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
					<CircleCheck className="size-4 text-primary" aria-hidden="true" />
					Ви оцінили цей курс
				</span>
				<Button
					variant="outline"
					size="sm"
					className="h-9"
					onClick={() => setIsRatingModalOpen(true)}
				>
					Змінити оцінку
				</Button>
			</div>
		);
	} else if (hasAttendedCourse && selectedOffering) {
		rateAction = (
			<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
				{canRateNow ? null : (
					<span className="text-sm text-muted-foreground">
						{CANNOT_RATE_TOOLTIP_TEXT}
					</span>
				)}
				<RatingButton
					canRate={canRateNow}
					onClick={() => setIsRatingModalOpen(true)}
					size="default"
				>
					Оцінити цей курс
				</RatingButton>
			</div>
		);
	}
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
				<CourseDetailsHeader
					title={course.title ?? ""}
					educationLevel={course.education_level}
					specialities={course.specialities ?? []}
					departmentName={course.department_name ?? ""}
					facultyName={course.faculty_name ?? ""}
					termLoads={termLoads}
				/>

				<div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
					<div className="min-w-0 space-y-8">
						{showStats || rateAction ? (
							<div>
								{showStats ? (
									<CourseStatsHero
										difficulty={course.avg_difficulty ?? null}
										usefulness={course.avg_usefulness ?? null}
										ratingsCount={course.ratings_count ?? null}
										action={rateAction}
									/>
								) : (
									<div className="flex flex-wrap items-center justify-between gap-3">
										{rateAction}
									</div>
								)}
							</div>
						) : null}

						{/* Phones read one column: scores, then «Про курс», then reviews. */}
						<div className="lg:hidden">{about}</div>

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

					<aside className="hidden min-w-0 lg:block">
						<div className="lg:sticky lg:top-24">{about}</div>
					</aside>
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

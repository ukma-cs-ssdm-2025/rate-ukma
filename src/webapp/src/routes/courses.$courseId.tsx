import * as React from "react";

import { createFileRoute } from "@tanstack/react-router";

import Layout from "@/components/Layout";
import { Button } from "@/components/ui/Button";
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
import { RatingModal } from "@/features/ratings/components/RatingModal";
import type { InlineCourseOffering } from "@/lib/api/generated";
import {
	useCoursesOfferingsList,
	useCoursesRetrieve,
	useStudentsMeCoursesRetrieve,
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

	const { data: studentCourses, isLoading: isStudentCoursesLoading } =
		useStudentsMeCoursesRetrieve();

	const { attendedOfferings, attendedCourseId } = React.useMemo(() => {
		const courseData = studentCourses?.find((c) => c.id === courseId);
		return {
			attendedOfferings: courseData?.offerings || [],
			attendedCourseId: courseData?.id,
		};
	}, [studentCourses, courseId]);

	const hasAttendedCourse = attendedOfferings.length > 0;

	const ratedOffering = React.useMemo(() => {
		return attendedOfferings.find(
			(offering: InlineCourseOffering) =>
				offering.rated !== null && offering.rated !== undefined,
		);
	}, [attendedOfferings]);

	const selectedOffering = ratedOffering || attendedOfferings[0] || null;

	if (isCourseLoading || isStudentCoursesLoading || isOfferingsLoading) {
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
							title={course.title}
							status={course.status}
							facultyName={course.faculty_name}
							departmentName={course.department_name}
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

				{hasAttendedCourse && selectedOffering && (
					<div className="flex justify-center">
						{(selectedOffering as any).can_rate !== false ? (
							<Button
								onClick={() => setIsRatingModalOpen(true)}
								size="lg"
								className="w-full max-w-md"
							>
								{ratedOffering ? "Редагувати оцінку" : "Оцінити цей курс"}
							</Button>
						) : (
							<div className="relative inline-block group">
								<Button
									variant="secondary"
									size="lg"
									disabled
									className="cursor-not-allowed opacity-40 bg-gray-400 w-full max-w-md"
								>
									{ratedOffering ? "Редагувати оцінку" : "Оцінити цей курс"}
								</Button>
								<div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap pointer-events-none z-10">
									Ви не можете оцінити курс, не послухавши його
									<div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></div>
								</div>
							</div>
						)}
					</div>
				)}

				<CourseRatingsList courseId={courseId} />
			</div>

			{selectedOffering?.id && attendedCourseId && (
				<RatingModal
					isOpen={isRatingModalOpen}
					onClose={() => setIsRatingModalOpen(false)}
					courseId={attendedCourseId}
					offeringId={selectedOffering.id}
					courseName={course.title}
					existingRating={ratedOffering?.rated || null}
					ratingId={ratedOffering?.rated?.id}
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

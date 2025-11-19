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

	if (isCourseLoading || isOfferingsLoading) {
		return (
			<Layout>
				<CourseDetailsSkeleton />
			</Layout>
		);
	}

	if (isCourseError || isOfferingsError || !course) {
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

				<CourseRatingsList courseId={courseId} />
			</div>
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

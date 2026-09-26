import { useMemo } from "react";

import { createFileRoute } from "@tanstack/react-router";

import Layout from "@/components/Layout";
import { MyRatingsEmptyState } from "@/features/ratings/components/MyRatingsEmptyState";
import { MyRatingsErrorState } from "@/features/ratings/components/MyRatingsErrorState";
import { MyRatingsHeader } from "@/features/ratings/components/MyRatingsHeader";
import { MyRatingsNotStudentState } from "@/features/ratings/components/MyRatingsNotStudentState";
import { MyRatingsSkeleton } from "@/features/ratings/components/MyRatingsSkeleton";
import { MyRatingsYearSection } from "@/features/ratings/components/MyRatingsYearSection";
import { groupRatingsByYearAndSemester } from "@/features/ratings/groupRatings";
import type { StudentRatingsDetailed } from "@/lib/api/generated";
import { useStudentsMeGradesRetrieve } from "@/lib/api/generated";
import { useAuth, withAuth } from "@/lib/auth";
import { testIds } from "@/lib/test-ids";

function MyRatings() {
	const { isStudent } = useAuth();

	const { data, isLoading, isFetching, error, refetch } =
		useStudentsMeGradesRetrieve({
			query: {
				enabled: isStudent,
			},
		});

	const ratings = useMemo<StudentRatingsDetailed[]>(() => {
		if (!data) return [];
		return Array.isArray(data) ? data : [data];
	}, [data]);

	const ratedCourses = useMemo(
		() => ratings.filter((course) => Boolean(course.rated)).length,
		[ratings],
	);

	const totalCourses = ratings.length;
	const isRefetching = isFetching && !isLoading;

	const groupedRatings = useMemo(
		() => groupRatingsByYearAndSemester(ratings),
		[ratings],
	);

	const rateableLeft = useMemo(
		() =>
			groupedRatings
				.flatMap((yearGroup) => yearGroup.seasons)
				.reduce((sum, season) => sum + season.unratedRateableCount, 0),
		[groupedRatings],
	);

	if (!isStudent) {
		return (
			<Layout>
				<MyRatingsNotStudentState />
			</Layout>
		);
	}
	if (isLoading) {
		return (
			<Layout>
				<div className="space-y-6">
					<MyRatingsHeader totalCourses={0} ratedCourses={0} />
					<MyRatingsSkeleton />
				</div>
			</Layout>
		);
	}
	if (error) {
		return (
			<Layout>
				<MyRatingsErrorState onRetry={refetch} isRetrying={isRefetching} />
			</Layout>
		);
	}
	if (totalCourses === 0) {
		return (
			<Layout>
				<div className="space-y-6">
					<MyRatingsHeader totalCourses={0} ratedCourses={0} />
					<MyRatingsEmptyState />
				</div>
			</Layout>
		);
	}
	return (
		<Layout>
			<div className="space-y-6">
				<MyRatingsHeader
					totalCourses={totalCourses}
					ratedCourses={ratedCourses}
					rateableLeft={rateableLeft}
				/>
				<div className="space-y-8" data-testid={testIds.myRatings.list}>
					{groupedRatings.map((yearGroup) => (
						<MyRatingsYearSection
							key={yearGroup.key}
							yearGroup={yearGroup}
							onRatingChanged={refetch}
						/>
					))}
				</div>
			</div>
		</Layout>
	);
}

export const Route = createFileRoute("/my-ratings")({
	component: withAuth(MyRatings),
});

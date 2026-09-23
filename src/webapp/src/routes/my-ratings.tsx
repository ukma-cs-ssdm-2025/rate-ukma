import { useMemo, useState } from "react";

import { createFileRoute } from "@tanstack/react-router";

import Layout from "@/components/Layout";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@/components/ui/Empty";
import { compareSemesters } from "@/features/courses/courseFormatting";
import { MyRatingsEmptyState } from "@/features/ratings/components/MyRatingsEmptyState";
import { MyRatingsErrorState } from "@/features/ratings/components/MyRatingsErrorState";
import { MyRatingsHeader } from "@/features/ratings/components/MyRatingsHeader";
import { MyRatingsNotStudentState } from "@/features/ratings/components/MyRatingsNotStudentState";
import { MyRatingsPendingSection } from "@/features/ratings/components/MyRatingsPendingSection";
import { MyRatingsSkeleton } from "@/features/ratings/components/MyRatingsSkeleton";
import { MyRatingsYearSection } from "@/features/ratings/components/MyRatingsYearSection";
import {
	groupRatingsByYearAndSemester,
	type RatingFilter,
	type YearGroup,
} from "@/features/ratings/groupRatings";
import type { StudentRatingsDetailed } from "@/lib/api/generated";
import { useStudentsMeGradesRetrieve } from "@/lib/api/generated";
import { useAuth, withAuth } from "@/lib/auth";
import { testIds } from "@/lib/test-ids";

function MyRatings() {
	const { isStudent } = useAuth();
	const [filter, setFilter] = useState<RatingFilter>("all");

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
	const pendingItems = useMemo(
		() =>
			[...ratings]
				.filter((course) => !course.rated && course.can_rate)
				.sort((a, b) => {
					const semesterA = a.semester;
					const semesterB = b.semester;
					if (
						semesterA?.year != null &&
						semesterA.season &&
						semesterB?.year != null &&
						semesterB.season
					) {
						const newestFirst = compareSemesters(
							{ year: semesterB.year, season: semesterB.season },
							{ year: semesterA.year, season: semesterA.season },
						);
						if (newestFirst !== 0) return newestFirst;
					} else if (
						(semesterA?.year ?? semesterA?.season) !==
						(semesterB?.year ?? semesterB?.season)
					) {
						return semesterB?.year || semesterB?.season ? 1 : -1;
					}
					return (a.course_title ?? "").localeCompare(b.course_title ?? "");
				}),
		[ratings],
	);

	const groupedRatings = useMemo(
		() => groupRatingsByYearAndSemester(ratings, filter),
		[ratings, filter],
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
					<MyRatingsHeader
						totalCourses={totalCourses}
						ratedCourses={ratedCourses}
						isLoading={isLoading}
						filter={filter}
						onFilterChange={setFilter}
					/>
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
				<MyRatingsEmptyState />
			</Layout>
		);
	}
	if (groupedRatings.length === 0 && filter !== "all") {
		return (
			<Layout>
				<div className="space-y-6">
					<MyRatingsHeader
						totalCourses={totalCourses}
						ratedCourses={ratedCourses}
						isLoading={isLoading}
						filter={filter}
						onFilterChange={setFilter}
					/>
					<Empty className="border-0 py-12">
						<EmptyHeader>
							<EmptyTitle>
								{filter === "unrated"
									? "Всі курси оцінено!"
									: "Поки що немає оцінок"}
							</EmptyTitle>
							<EmptyDescription>
								{filter === "unrated"
									? "Дякуємо, що оцінили всі свої курси."
									: "Оберіть інший фільтр або оцініть перший курс зі списку."}
							</EmptyDescription>
						</EmptyHeader>
					</Empty>
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
					isLoading={isLoading}
					filter={filter}
					onFilterChange={setFilter}
				/>
				<MyRatingsContent
					filter={filter}
					onFilterChange={setFilter}
					pendingItems={pendingItems}
					groupedRatings={groupedRatings}
					refetch={refetch}
				/>
			</div>
		</Layout>
	);
}

export const Route = createFileRoute("/my-ratings")({
	component: withAuth(MyRatings),
});

interface MyRatingsContentProps {
	filter: RatingFilter;
	onFilterChange: (filter: RatingFilter) => void;
	pendingItems: StudentRatingsDetailed[];
	groupedRatings: YearGroup[];
	refetch: () => undefined | Promise<unknown>;
}

function MyRatingsContent({
	filter,
	onFilterChange,
	pendingItems,
	groupedRatings,
	refetch,
}: Readonly<MyRatingsContentProps>) {
	return (
		<div className="space-y-8" data-testid={testIds.myRatings.list}>
			{filter === "all" && pendingItems.length > 0 ? (
				<MyRatingsPendingSection
					items={pendingItems}
					variant="preview"
					onRatingChanged={refetch}
					onShowAll={() => onFilterChange("unrated")}
				/>
			) : null}
			{filter === "unrated" && pendingItems.length > 0 ? (
				<MyRatingsPendingSection
					items={pendingItems}
					variant="grouped"
					onRatingChanged={refetch}
				/>
			) : null}
			{groupedRatings.map((yearGroup) => (
				<MyRatingsYearSection
					key={yearGroup.key}
					yearGroup={yearGroup}
					onRatingChanged={refetch}
				/>
			))}
		</div>
	);
}

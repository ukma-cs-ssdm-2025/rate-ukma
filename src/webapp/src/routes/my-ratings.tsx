import { type ReactNode, useMemo } from "react";

import { createFileRoute } from "@tanstack/react-router";

import Layout from "@/components/Layout";
import { getSemesterTermDisplay } from "@/features/courses/courseFormatting";
import { MyRatingCard } from "@/features/ratings/components/MyRatingCard";
import { MyRatingsEmptyState } from "@/features/ratings/components/MyRatingsEmptyState";
import { MyRatingsErrorState } from "@/features/ratings/components/MyRatingsErrorState";
import { MyRatingsHeader } from "@/features/ratings/components/MyRatingsHeader";
import { MyRatingsNotStudentState } from "@/features/ratings/components/MyRatingsNotStudentState";
import { MyRatingsSkeleton } from "@/features/ratings/components/MyRatingsSkeleton";
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
		if (!data) {
			return [];
		}
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

	let content: ReactNode;

	if (!isStudent) {
		content = <MyRatingsNotStudentState />;
	} else if (isLoading) {
		content = <MyRatingsSkeleton />;
	} else if (error) {
		content = (
			<MyRatingsErrorState onRetry={refetch} isRetrying={isRefetching} />
		);
	} else if (totalCourses === 0) {
		content = <MyRatingsEmptyState />;
	} else {
		content = (
			<div className="space-y-8" data-testid={testIds.myRatings.list}>
				{groupedRatings.map((yearGroup) => (
					<div key={yearGroup.key} className="space-y-4">
						<div className="border-l-3 border-primary pl-4">
							<h2 className="text-xl font-semibold text-foreground">
								{yearGroup.label}
							</h2>
							<p className="text-sm text-muted-foreground">
								Оцінено: {yearGroup.ratedCount} / {yearGroup.total}
							</p>
						</div>

						{yearGroup.seasons.map((seasonGroup) => (
							<div key={seasonGroup.key} className="space-y-3">
								<div className="flex items-center gap-3 px-4 py-2">
									<span className="text-lg font-semibold text-foreground">
										{seasonGroup.label}
									</span>
									<span className="text-xs text-muted-foreground/70">
										{seasonGroup.ratedCount} / {seasonGroup.items.length}
									</span>
								</div>
								<div className="space-y-3">
									{seasonGroup.items.map((course, index) => (
										<MyRatingCard
											key={
												course.course_offering_id ??
												course.course_id ??
												`${seasonGroup.key}-${index}`
											}
											course={course}
											onRatingChanged={refetch}
										/>
									))}
								</div>
							</div>
						))}
					</div>
				))}
			</div>
		);
	}

	return (
		<Layout>
			<div className="space-y-8">
				<MyRatingsHeader
					totalCourses={totalCourses}
					ratedCourses={ratedCourses}
					isLoading={isLoading}
				/>
				{content}
			</div>
		</Layout>
	);
}

export const Route = createFileRoute("/my-ratings")({
	component: withAuth(MyRatings),
});

interface SemesterGroup {
	key: string;
	label: string;
	description: string;
	items: StudentRatingsDetailed[];
	order: number;
	ratedCount: number;
}

interface YearGroup {
	key: string;
	label: string;
	seasons: SemesterGroup[];
	year?: number;
	total: number;
	ratedCount: number;
}

const TERM_ORDER: Record<string, number> = {
	SUMMER: 1,
	SPRING: 2,
	FALL: 3,
};

function getAcademicYear(
	year: number,
	season: string | undefined,
): { academicYearStart: number; academicYearLabel: string } {
	const academicYearStart = season?.toUpperCase() === "FALL" ? year : year - 1;
	const academicYearLabel = `${academicYearStart} – ${academicYearStart + 1}`;

	return { academicYearStart, academicYearLabel };
}

function groupRatingsByYearAndSemester(
	items: StudentRatingsDetailed[],
): YearGroup[] {
	type YearAccumulator = {
		key: string;
		label: string;
		year?: number;
		seasons: Map<string, SemesterGroup>;
	};

	const years = new Map<string, YearAccumulator>();

	for (const course of items) {
		const yearValue =
			typeof course.semester?.year === "number"
				? course.semester?.year
				: undefined;
		const seasonRaw = course.semester?.season?.toUpperCase();

		let yearKey: string;
		let yearLabel: string;
		let academicYearStart: number | undefined;

		if (yearValue == null) {
			yearKey = "unknown";
			yearLabel = "Без року";
		} else {
			const { academicYearStart: ayStart, academicYearLabel } = getAcademicYear(
				yearValue,
				seasonRaw,
			);
			academicYearStart = ayStart;
			yearKey = String(ayStart);
			yearLabel = academicYearLabel;
		}

		if (!years.has(yearKey)) {
			years.set(yearKey, {
				key: yearKey,
				label: yearLabel,
				year: academicYearStart,
				seasons: new Map(),
			});
		}

		let seasonKey = "no-semester";
		let seasonLabel = "Без семестра";
		let seasonDescription = "Невідомий рік";

		if (yearValue != null) {
			seasonKey = seasonRaw ?? "no-semester";
			seasonLabel = seasonRaw
				? getSemesterTermDisplay(seasonRaw, "Невідомий семестр")
				: "Семестр не вказано";
			seasonDescription = seasonRaw
				? `Семестр ${seasonLabel.toLowerCase()}`
				: "Без семестра";
		}

		const seasonOrder = TERM_ORDER[seasonRaw ?? ""] ?? 99;

		const yearEntry = years.get(yearKey);
		if (yearEntry) {
			if (!yearEntry.seasons.has(seasonKey)) {
				yearEntry.seasons.set(seasonKey, {
					key: `${yearKey}-${seasonKey}`,
					label: seasonLabel,
					description: seasonDescription,
					items: [],
					order: seasonOrder,
					ratedCount: 0,
				});
			}

			const season = yearEntry.seasons.get(seasonKey);
			if (season) {
				season.items.push(course);
				if (course.rated) {
					season.ratedCount++;
				}
			}
		}
	}
	const yearGroups: YearGroup[] = Array.from(years.values()).map(
		({ seasons, ...rest }) => {
			const seasonsArray = Array.from(seasons.values()).sort((a, b) => {
				return a.order - b.order || a.label.localeCompare(b.label);
			});

			const total = seasonsArray.reduce(
				(sum, season) => sum + season.items.length,
				0,
			);

			const ratedCount = seasonsArray.reduce(
				(sum, season) => sum + season.ratedCount,
				0,
			);

			return {
				...rest,
				seasons: seasonsArray,
				total,
				ratedCount,
			};
		},
	);

	return yearGroups.sort((a, b) => {
		if (a.year != null && b.year != null) {
			return b.year - a.year;
		}
		if (a.year != null) {
			return -1;
		}
		if (b.year != null) {
			return 1;
		}
		return a.label.localeCompare(b.label);
	});
}

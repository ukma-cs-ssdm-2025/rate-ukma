import { type ReactNode, useCallback, useMemo, useState } from "react";

import { createFileRoute } from "@tanstack/react-router";

import Layout from "@/components/Layout";
import { MyRatingsEmptyState } from "@/features/ratings/components/MyRatingsEmptyState";
import { MyRatingsErrorState } from "@/features/ratings/components/MyRatingsErrorState";
import { MyRatingsHeader } from "@/features/ratings/components/MyRatingsHeader";
import { MyRatingsNotStudentState } from "@/features/ratings/components/MyRatingsNotStudentState";
import { MyRatingsSkeleton } from "@/features/ratings/components/MyRatingsSkeleton";
import { MyRatingsYearSection } from "@/features/ratings/components/MyRatingsYearSection";
import {
	groupRatingsByYearAndSemester,
	type RatingFilter,
} from "@/features/ratings/groupRatings";
import type { StudentRatingsDetailed } from "@/lib/api/generated";
import { useStudentsMeGradesRetrieve } from "@/lib/api/generated";
import { useAuth, withAuth } from "@/lib/auth";
import { localStorageAdapter } from "@/lib/storage";
import { testIds } from "@/lib/test-ids";

const COLLAPSIBLE_STATE_KEY = "my-ratings-collapsible-state";
const COLLAPSIBLE_STATE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface StoredWithTimestamp<T> {
	data: T;
	storedAt: number;
}

function getCollapsibleState(): Record<string, boolean> {
	const stored = localStorageAdapter.getItem<
		StoredWithTimestamp<Record<string, boolean>>
	>(COLLAPSIBLE_STATE_KEY);
	if (!stored) return {};
	if (Date.now() - stored.storedAt > COLLAPSIBLE_STATE_TTL_MS) {
		localStorageAdapter.removeItem(COLLAPSIBLE_STATE_KEY);
		return {};
	}
	return stored.data;
}

function saveCollapsibleState(state: Record<string, boolean>): void {
	const value: StoredWithTimestamp<Record<string, boolean>> = {
		data: state,
		storedAt: Date.now(),
	};
	localStorageAdapter.setItem(COLLAPSIBLE_STATE_KEY, value);
}

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

	const groupedRatings = useMemo(
		() => groupRatingsByYearAndSemester(ratings, filter),
		[ratings, filter],
	);

	const [collapsedState, setCollapsedState] =
		useState<Record<string, boolean>>(getCollapsibleState);

	const updateCollapsedState = useCallback((key: string, isOpen: boolean) => {
		setCollapsedState((prev) => {
			const next = { ...prev, [key]: isOpen };
			saveCollapsibleState(next);
			return next;
		});
	}, []);

	const toggleAll = useCallback(
		(open: boolean) => {
			const next: Record<string, boolean> = {};
			for (const yearGroup of groupedRatings) {
				for (const season of yearGroup.seasons) {
					next[season.key] = open;
				}
			}
			setCollapsedState(next);
			saveCollapsibleState(next);
		},
		[groupedRatings],
	);

	const isAllExpanded = useMemo(() => {
		const currentKeys = groupedRatings.flatMap((year) =>
			year.seasons.map((s) => s.key),
		);
		if (currentKeys.length === 0) return false;
		return currentKeys.every((key) => collapsedState[key]);
	}, [groupedRatings, collapsedState]);

	const handleToggleExpandAll = useCallback(() => {
		toggleAll(!isAllExpanded);
	}, [toggleAll, isAllExpanded]);

	const content = resolveContent({
		isStudent,
		isLoading,
		error,
		totalCourses,
		isRefetching,
		refetch,
		filter,
		groupedRatings,
		collapsedState,
		updateCollapsedState,
	});

	return (
		<Layout>
			<div className="space-y-6">
				<MyRatingsHeader
					totalCourses={totalCourses}
					ratedCourses={ratedCourses}
					isLoading={isLoading}
					filter={filter}
					onFilterChange={setFilter}
					isAllExpanded={isAllExpanded}
					onToggleExpandAll={handleToggleExpandAll}
				/>
				{content}
			</div>
		</Layout>
	);
}

export const Route = createFileRoute("/my-ratings")({
	component: withAuth(MyRatings),
});

function resolveContent({
	isStudent,
	isLoading,
	error,
	totalCourses,
	isRefetching,
	refetch,
	filter,
	groupedRatings,
	collapsedState,
	updateCollapsedState,
}: {
	isStudent: boolean;
	isLoading: boolean;
	error: unknown;
	totalCourses: number;
	isRefetching: boolean;
	refetch: () => undefined | Promise<unknown>;
	filter: RatingFilter;
	groupedRatings: ReturnType<typeof groupRatingsByYearAndSemester>;
	collapsedState: Record<string, boolean>;
	updateCollapsedState: (key: string, isOpen: boolean) => void;
}): ReactNode {
	if (!isStudent) {
		return <MyRatingsNotStudentState />;
	}
	if (isLoading) {
		return <MyRatingsSkeleton />;
	}
	if (error) {
		return <MyRatingsErrorState onRetry={refetch} isRetrying={isRefetching} />;
	}
	if (totalCourses === 0) {
		return <MyRatingsEmptyState />;
	}
	if (groupedRatings.length === 0 && filter !== "all") {
		return (
			<div className="text-center py-12">
				<p className="text-muted-foreground">
					{filter === "unrated" && "Всі курси оцінено! 🎉"}
					{filter === "rated" && "Ви ще не оцінили жодного курсу"}
				</p>
			</div>
		);
	}
	return (
		<div className="space-y-8" data-testid={testIds.myRatings.list}>
			{groupedRatings.map((yearGroup) => (
				<MyRatingsYearSection
					key={yearGroup.key}
					yearGroup={yearGroup}
					onRatingChanged={refetch}
					collapsedState={collapsedState}
					onToggle={updateCollapsedState}
				/>
			))}
		</div>
	);
}

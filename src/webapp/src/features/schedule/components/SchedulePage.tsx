import { useMemo } from "react";

import Layout from "@/components/Layout";
import { PageHeader } from "@/components/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { groupRatingsByYearAndSemester } from "@/features/ratings/groupRatings";
import { useStudentsMeGradesRetrieve } from "@/lib/api/generated";
import { useAuth } from "@/lib/auth";
import { useFeatureFlagState } from "@/lib/feature-flags";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { RateNudge, ScheduleCourseList } from "./ScheduleRail";
import { ScheduleAgenda } from "./ScheduleAgenda";
import { WeekGrid } from "./WeekGrid";
import { useMySchedule } from "../hooks/useMySchedule";
import { formatWeekRange } from "../scheduleDates";

function useRateableLeft(enabled: boolean): number {
	const { data } = useStudentsMeGradesRetrieve({ query: { enabled } });
	return useMemo(() => {
		if (!data) return 0;
		const ratings = Array.isArray(data) ? data : [data];
		return groupRatingsByYearAndSemester(ratings)
			.flatMap((year) => year.seasons)
			.reduce((sum, season) => sum + season.unratedRateableCount, 0);
	}, [data]);
}

export function SchedulePage() {
	const { isStudent } = useAuth();
	const { enabled, isReady } = useFeatureFlagState("fe_schedule");
	const active = isReady && enabled && isStudent;
	const { data: schedule, isLoading } = useMySchedule({ enabled: active });
	const rateableLeft = useRateableLeft(active);
	const isDesktop = useMediaQuery("(min-width: 1024px)");

	const courses = useMemo(
		() => new Map(schedule?.courses.map((course) => [course.id, course])),
		[schedule],
	);

	// Stay blank until the flag resolves, so a disabled page never flashes in.
	if (!isReady) return <Layout>{null}</Layout>;
	if (!enabled || !isStudent) {
		return (
			<Layout>
				<p className="text-muted-foreground">Розклад поки недоступний.</p>
			</Layout>
		);
	}

	return (
		<Layout>
			<div className="space-y-6">
				<PageHeader
					title="Розклад"
					description={
						schedule
							? `${schedule.semester}, тиждень ${schedule.week.number}: ${formatWeekRange(schedule.week.starts_on)}`
							: undefined
					}
				/>
				{isLoading || !schedule ? (
					<Skeleton className="h-96 w-full rounded-xl" />
				) : (
					<div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start">
						<aside className="space-y-4">
							<RateNudge count={rateableLeft} />
							{isDesktop ? (
								<ScheduleCourseList
									courses={schedule.courses}
									calendarConnected={schedule.calendar_connected}
								/>
							) : null}
						</aside>
						{isDesktop ? (
							<WeekGrid schedule={schedule} courses={courses} />
						) : (
							<>
								<ScheduleAgenda schedule={schedule} courses={courses} />
								<ScheduleCourseList
									courses={schedule.courses}
									calendarConnected={schedule.calendar_connected}
								/>
							</>
						)}
					</div>
				)}
			</div>
		</Layout>
	);
}

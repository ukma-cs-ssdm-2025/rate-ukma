import { useMemo } from "react";

import { useQueries } from "@tanstack/react-query";

import type {
	CourseOffering,
	StudentRatingsDetailed,
} from "@/lib/api/generated";
import {
	getCourseOfferingsRetrieveQueryOptions,
	useStudentsMeGradesRetrieve,
} from "@/lib/api/generated";
import { useAuth } from "@/lib/auth";
import { courseKindFor, offeringLoad } from "../planOffering";
import {
	isPlanTerm,
	semesterKey,
	studyYearOf,
	type SemesterCoursesByKey,
} from "../planTimeline";
import type { PlanSemesterCourses } from "../planTypes";
import { getAcademicStartYear } from "@/features/courses/courseFormatting";

// Offerings of past semesters do not change, so one fetch per session is enough.
const OFFERING_STALE_TIME = 30 * 60 * 1000;

interface TakenEnrollment {
	enrollment: StudentRatingsDetailed;
	year: number;
	term: "FALL" | "SPRING" | "SUMMER";
}

function datedEnrollments(
	enrollments: readonly StudentRatingsDetailed[],
): TakenEnrollment[] {
	return enrollments.flatMap((enrollment) => {
		const year = enrollment.semester?.year;
		const term = enrollment.semester?.season?.toUpperCase();
		return typeof year === "number" && isPlanTerm(term)
			? [{ enrollment, year, term }]
			: [];
	});
}

function earliestAcademicYear(enrollments: readonly TakenEnrollment[]) {
	const starts = enrollments.map(
		({ year, term }) => getAcademicStartYear(year, term) ?? year,
	);
	return starts.length > 0 ? Math.min(...starts) : null;
}

export function useTakenCourses({ enabled }: Readonly<{ enabled: boolean }>) {
	const { speciality } = useAuth();
	const grades = useStudentsMeGradesRetrieve({ query: { enabled } });

	const enrollments = useMemo(() => {
		if (!grades.data) return [];
		return datedEnrollments(
			Array.isArray(grades.data) ? grades.data : [grades.data],
		);
	}, [grades.data]);

	const offerings = useQueries({
		queries: enrollments.map(({ enrollment }) => ({
			...getCourseOfferingsRetrieveQueryOptions(
				enrollment.course_offering_id ?? "",
			),
			enabled: Boolean(enrollment.course_offering_id),
			staleTime: OFFERING_STALE_TIME,
		})),
		combine: (results) => ({
			data: results.map((query) => query.data),
			isPending: results.some((query) => query.isPending),
		}),
	});

	const enrollmentYearStart = earliestAcademicYear(enrollments);

	const taken = useMemo<SemesterCoursesByKey>(() => {
		if (enrollmentYearStart == null) return {};
		const byKey: Record<string, PlanSemesterCourses> = {};
		enrollments.forEach(({ enrollment, year, term }, index) => {
			const offering: CourseOffering | undefined = offerings.data[index];
			const key = semesterKey({
				studyYear: studyYearOf(enrollmentYearStart, year, term),
				term,
			});
			byKey[key] ??= { main: [], backup: [] };
			byKey[key].main.push({
				courseId: enrollment.course_id ?? "",
				title: enrollment.course_title ?? "",
				kind: courseKindFor(offering?.specialities, speciality?.id),
				facultyName: enrollment.faculty_name ?? null,
				...offeringLoad(offering, term),
				locked: true,
			});
		});
		return byKey;
	}, [enrollments, enrollmentYearStart, speciality?.id, offerings.data]);

	return {
		taken,
		enrollmentYearStart,
		isLoading:
			grades.isLoading || (enrollments.length > 0 && offerings.isPending),
		error: grades.error,
		isRetrying: grades.isFetching && !grades.isLoading,
		refetch: grades.refetch,
	};
}

import { isPlanTerm, semesterKey } from "./planTimeline";
import type {
	PlanCourse,
	PlanSemesterCourses,
	PlanSlot,
	PlanTarget,
} from "./planTypes";

/**
 * The student's picks for planned years. Kept in the browser until the
 * backend stores plans; bump the version when the shape changes.
 */
export interface StoredPlan {
	version: 1;
	semesters: Record<string, PlanSemesterCourses>;
}

export const EMPTY_PLAN: StoredPlan = { version: 1, semesters: {} };

export function planStorageKey(userId: number): string {
	return `personal-plan:v1:${userId}`;
}

export function readStoredPlan(value: StoredPlan | null): StoredPlan {
	return value?.version === 1 && value.semesters ? value : EMPTY_PLAN;
}

function updateSemester(
	plan: StoredPlan,
	target: PlanTarget,
	update: (semester: PlanSemesterCourses) => PlanSemesterCourses,
): StoredPlan {
	const key = semesterKey(target);
	const semester = plan.semesters[key] ?? { main: [], backup: [] };
	return {
		...plan,
		semesters: { ...plan.semesters, [key]: update(semester) },
	};
}

const without = (courses: readonly PlanCourse[], courseId: string) =>
	courses.filter((course) => course.courseId !== courseId);

export function addCourse(
	plan: StoredPlan,
	target: PlanTarget,
	course: PlanCourse,
	slot: PlanSlot,
): StoredPlan {
	return updateSemester(plan, target, (semester) => {
		const main = without(semester.main, course.courseId);
		const backup = without(semester.backup, course.courseId);
		return slot === "main"
			? { main: [...main, course], backup }
			: { main, backup: [...backup, course] };
	});
}

export function removeCourse(
	plan: StoredPlan,
	target: PlanTarget,
	courseId: string,
): StoredPlan {
	return updateSemester(plan, target, (semester) => ({
		main: without(semester.main, courseId),
		backup: without(semester.backup, courseId),
	}));
}

export function promoteBackup(
	plan: StoredPlan,
	target: PlanTarget,
	courseId: string,
): StoredPlan {
	const key = semesterKey(target);
	const course = plan.semesters[key]?.backup.find(
		(backup) => backup.courseId === courseId,
	);
	return course ? addCourse(plan, target, course, "main") : plan;
}

/** Makes a main course a backup, freeing its credits for another pick. */
export function demoteToBackup(
	plan: StoredPlan,
	target: PlanTarget,
	courseId: string,
): StoredPlan {
	const key = semesterKey(target);
	const course = plan.semesters[key]?.main.find(
		(main) => main.courseId === courseId,
	);
	return course ? addCourse(plan, target, course, "backup") : plan;
}

export interface PlannedPlace {
	target: PlanTarget;
	slot: PlanSlot;
}

/** Where the student has put a course, if anywhere. */
export function findPlannedCourse(
	semesters: StoredPlan["semesters"],
	courseId: string,
): PlannedPlace | null {
	for (const [key, semester] of Object.entries(semesters)) {
		const [studyYear, term] = key.split("-");
		if (!isPlanTerm(term)) continue;
		const target = { studyYear: Number(studyYear), term };
		if (semester.main.some((course) => course.courseId === courseId)) {
			return { target, slot: "main" };
		}
		if (semester.backup.some((course) => course.courseId === courseId)) {
			return { target, slot: "backup" };
		}
	}
	return null;
}

import { useCallback, useState } from "react";

import type { PlanCourse, PlanSemester, PlanYear } from "../studyPlanTypes";

type SemesterUpdater = (semester: PlanSemester) => PlanSemester;

function updateSemester(
	years: PlanYear[],
	semesterKey: string,
	updater: SemesterUpdater,
): PlanYear[] {
	return years.map((year) => ({
		...year,
		semesters: year.semesters.map((semester) =>
			semester.key === semesterKey ? updater(semester) : semester,
		),
	}));
}

export function useStudyPlanState(initialYears: PlanYear[]) {
	const [years, setYears] = useState<PlanYear[]>(initialYears);

	const addCourse = useCallback(
		(semesterKey: string, course: PlanCourse, asBackup: boolean) => {
			const added = { ...course, id: `${course.id}-${semesterKey}` };
			setYears((prev) =>
				updateSemester(prev, semesterKey, (semester) =>
					asBackup
						? { ...semester, backups: [...semester.backups, added] }
						: { ...semester, courses: [...semester.courses, added] },
				),
			);
		},
		[],
	);

	const removeCourse = useCallback((semesterKey: string, courseId: string) => {
		setYears((prev) =>
			updateSemester(prev, semesterKey, (semester) => ({
				...semester,
				courses: semester.courses.filter((c) => c.id !== courseId),
				backups: semester.backups.filter((c) => c.id !== courseId),
			})),
		);
	}, []);

	const promoteBackup = useCallback((semesterKey: string, courseId: string) => {
		setYears((prev) =>
			updateSemester(prev, semesterKey, (semester) => {
				const course = semester.backups.find((c) => c.id === courseId);
				if (!course) return semester;
				return {
					...semester,
					courses: [...semester.courses, course],
					backups: semester.backups.filter((c) => c.id !== courseId),
				};
			}),
		);
	}, []);

	return { years, addCourse, removeCourse, promoteBackup };
}

export type StudyPlanActions = Omit<
	ReturnType<typeof useStudyPlanState>,
	"years"
>;

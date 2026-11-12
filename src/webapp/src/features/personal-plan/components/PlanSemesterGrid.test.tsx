import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { testIds } from "@/lib/test-ids";
import type { PlanActions } from "../hooks/usePlannedCourses";
import type { PlanCourse, PlanSemester } from "../planTypes";
import { PlanSemesterGrid } from "./PlanSemesterGrid";

vi.mock("@tanstack/react-router", async () => {
	const actual = await vi.importActual("@tanstack/react-router");
	return {
		...actual,
		Link: ({ children }: { children: React.ReactNode }) => (
			<a href="/">{children}</a>
		),
	};
});

function course(courseId: string, kind: PlanCourse["kind"]): PlanCourse {
	return {
		courseId,
		title: courseId,
		kind,
		facultyName: null,
		credits: 4,
		weeklyHours: 3,
	};
}

const semesters: PlanSemester[] = [
	{
		term: "FALL",
		main: [
			course("Бази даних", "COMPULSORY"),
			course("Хмарні обчислення", "PROF_ORIENTED"),
		],
		backup: [course("Розподілені системи", "PROF_ORIENTED")],
		unavailable: false,
	},
	{ term: "SPRING", main: [], backup: [], unavailable: false },
	{ term: "SUMMER", main: [], backup: [], unavailable: true },
];

function actions(): PlanActions {
	return { add: vi.fn(), remove: vi.fn(), promote: vi.fn(), demote: vi.fn() };
}

describe("PlanSemesterGrid", () => {
	it("lets the student drop a chosen course but not a compulsory one", async () => {
		const planActions = actions();
		render(
			<PlanSemesterGrid
				studyYear={3}
				semesters={semesters}
				showBackups
				actions={planActions}
				onAddCourse={vi.fn()}
			/>,
		);

		expect(
			screen.queryByRole("button", { name: "Прибрати Бази даних" }),
		).toBeNull();
		await userEvent.click(
			screen.getByRole("button", { name: "Прибрати Хмарні обчислення" }),
		);
		expect(planActions.remove).toHaveBeenCalledWith(
			{ studyYear: 3, term: "FALL" },
			"Хмарні обчислення",
		);
	});

	it("promotes a backup to main", async () => {
		const planActions = actions();
		render(
			<PlanSemesterGrid
				studyYear={3}
				semesters={semesters}
				showBackups
				actions={planActions}
			/>,
		);

		await userEvent.click(
			screen.getByRole("button", {
				name: "Зробити основною: Розподілені системи",
			}),
		);
		expect(planActions.promote).toHaveBeenCalledWith(
			{ studyYear: 3, term: "FALL" },
			"Розподілені системи",
		);
	});

	it("hides backups in the main-only view", () => {
		render(
			<PlanSemesterGrid
				studyYear={3}
				semesters={semesters}
				showBackups={false}
			/>,
		);
		expect(screen.queryByTestId(testIds.personalPlan.backupRow)).toBeNull();
		expect(screen.getAllByTestId(testIds.personalPlan.courseRow)).toHaveLength(
			2,
		);
	});

	it("is read-only without actions", () => {
		render(
			<PlanSemesterGrid studyYear={1} semesters={semesters} showBackups />,
		);
		expect(screen.queryByRole("button")).toBeNull();
	});

	it("offers adding to open semesters and explains the missing summer", async () => {
		const onAddCourse = vi.fn();
		render(
			<PlanSemesterGrid
				studyYear={4}
				semesters={semesters}
				showBackups
				actions={actions()}
				onAddCourse={onAddCourse}
			/>,
		);

		const addButtons = screen.getAllByTestId(
			testIds.personalPlan.addCourseButton,
		);
		expect(addButtons).toHaveLength(2);
		expect(
			screen.getByText("На останньому курсі літнього семестру немає"),
		).toBeTruthy();

		await userEvent.click(addButtons[1]!);
		expect(onAddCourse).toHaveBeenCalledWith("SPRING");
	});
});

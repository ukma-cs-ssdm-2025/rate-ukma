import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type {
	PlanCourse,
	PlanSemester,
	TypeKindEnum,
} from "@/lib/api/generated";
import { testIds } from "@/lib/test-ids";
import type { PlanActions } from "../hooks/usePlanActions";
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

function course(courseId: string, kind: TypeKindEnum): PlanCourse {
	return {
		course_id: courseId,
		title: courseId,
		type_kind: kind,
		faculty_name: "ФІ",
		credits: "4.0",
		weekly_hours: 3,
		is_mandatory: kind === "COMPULSORY",
	};
}

const semesters: PlanSemester[] = [
	{
		semester_term: "FALL",
		main: [
			course("Бази даних", "COMPULSORY"),
			course("Хмарні обчислення", "PROF_ORIENTED"),
		],
		backup: [course("Розподілені системи", "PROF_ORIENTED")],
		is_graduation_summer: false,
	},
	{
		semester_term: "SPRING",
		main: [],
		backup: [],
		is_graduation_summer: false,
	},
	{
		semester_term: "SUMMER",
		main: [],
		backup: [],
		is_graduation_summer: true,
	},
];

function actions(): PlanActions {
	return {
		add: vi.fn(),
		remove: vi.fn(),
		promote: vi.fn(),
		demote: vi.fn(),
		isSaving: false,
	};
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
		expect(planActions.remove).toHaveBeenCalledWith("Хмарні обчислення");
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
			{ study_year: 3, semester_term: "FALL" },
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

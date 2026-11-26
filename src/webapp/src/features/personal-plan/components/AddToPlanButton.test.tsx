import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PlanYear } from "@/lib/api/generated";
import { testIds } from "@/lib/test-ids";
import { AddToPlanButton, type PlanCandidate } from "./AddToPlanButton";

const state = vi.hoisted(() => ({
	flag: { enabled: true, isReady: true },
	isStudent: true,
	years: [] as PlanYear[],
	isLoading: false,
}));

vi.mock("@tanstack/react-router", async () => {
	const actual = await vi.importActual("@tanstack/react-router");
	return {
		...actual,
		Link: ({ children }: { children: React.ReactNode }) => (
			<a href="/plan">{children}</a>
		),
	};
});
vi.mock("@/lib/feature-flags/useFeatureFlag", () => ({
	useFeatureFlagState: () => state.flag,
}));
vi.mock("@/lib/auth/useAuth", () => ({
	useAuth: () => ({ isStudent: state.isStudent }),
}));
vi.mock("../hooks/usePersonalPlan", () => ({
	usePersonalPlan: () => ({
		years: state.years,
		isLoading: state.isLoading,
	}),
}));
vi.mock("./AddToPlanDialog", () => ({ AddToPlanDialog: () => null }));

const COURSE: PlanCandidate = {
	courseId: "game-theory",
	title: "Теорія ігор",
	facultyName: "ФІ",
	specialities: [],
	offerings: [],
};

function yearWith(slot: "main" | "backup", isMandatory = false): PlanYear {
	const entry = {
		course_id: "game-theory",
		title: "Теорія ігор",
		type_kind: "ELECTIVE" as const,
		faculty_name: "ФІ",
		credits: "3.0",
		weekly_hours: 2,
		is_mandatory: isMandatory,
	};
	return {
		study_year: 3,
		academic_year_start: 2027,
		year_status: "planned",
		semesters: [
			{
				semester_term: "FALL",
				main: slot === "main" ? [entry] : [],
				backup: slot === "backup" ? [entry] : [],
				is_graduation_summer: false,
			},
		],
	};
}

beforeEach(() => {
	state.flag = { enabled: true, isReady: true };
	state.isStudent = true;
	state.years = [];
	state.isLoading = false;
});

describe("AddToPlanButton (US-5.1)", () => {
	it("offers to add a course that is not in the plan", () => {
		render(<AddToPlanButton course={COURSE} />);

		expect(
			screen.getByTestId(testIds.personalPlan.addToPlanButton),
		).toBeTruthy();
		expect(screen.queryByText("У вашому ІНП")).toBeNull();
	});

	it("says the course is in the plan, with its year and semester, instead of offering to add it again", () => {
		state.years = [yearWith("main")];

		render(<AddToPlanButton course={COURSE} />);

		expect(screen.getByText("У вашому ІНП")).toBeTruthy();
		expect(screen.getByText(/3 курс · осінній семестр/)).toBeTruthy();
		expect(
			screen.queryByTestId(testIds.personalPlan.addToPlanButton),
		).toBeNull();
	});

	it("labels a backup pick as backup", () => {
		state.years = [yearWith("backup")];

		render(<AddToPlanButton course={COURSE} />);

		expect(screen.getByText(/запасна/)).toBeTruthy();
	});

	it("does not let the student change a mandatory course", () => {
		state.years = [yearWith("main", true)];

		render(<AddToPlanButton course={COURSE} />);

		expect(screen.getByText("У вашому ІНП")).toBeTruthy();
		expect(screen.queryByRole("button", { name: "Змінити" })).toBeNull();
	});

	it("shows nothing for a user who is not a student", () => {
		state.isStudent = false;

		const { container } = render(<AddToPlanButton course={COURSE} />);

		expect(container.innerHTML).toBe("");
	});

	it("shows nothing while the feature flag is off", () => {
		state.flag = { enabled: false, isReady: true };

		const { container } = render(<AddToPlanButton course={COURSE} />);

		expect(container.innerHTML).toBe("");
	});

	it("waits for the plan so a planned course never offers to add itself", () => {
		state.isLoading = true;

		const { container } = render(<AddToPlanButton course={COURSE} />);

		expect(container.innerHTML).toBe("");
	});
});

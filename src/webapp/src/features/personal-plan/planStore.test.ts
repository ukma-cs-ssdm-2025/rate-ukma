import { describe, expect, it } from "vitest";

import {
	addCourse,
	demoteToBackup,
	EMPTY_PLAN,
	findPlannedCourse,
	promoteBackup,
	readStoredPlan,
	removeCourse,
	type StoredPlan,
} from "./planStore";
import type { PlanCourse, PlanTarget } from "./planTypes";

const fall: PlanTarget = { studyYear: 3, term: "FALL" };

function course(courseId: string): PlanCourse {
	return {
		courseId,
		title: courseId,
		kind: "ELECTIVE",
		facultyName: null,
		credits: 3,
		weeklyHours: 2,
	};
}

const ids = (plan: StoredPlan) => {
	const semester = plan.semesters["3-FALL"];
	return {
		main: semester?.main.map((c) => c.courseId),
		backup: semester?.backup.map((c) => c.courseId),
	};
};

describe("planStore", () => {
	it("adds a course as main or backup", () => {
		let plan = addCourse(EMPTY_PLAN, fall, course("a"), "main");
		plan = addCourse(plan, fall, course("b"), "backup");
		expect(ids(plan)).toEqual({ main: ["a"], backup: ["b"] });
	});

	it("keeps a course in one slot only", () => {
		let plan = addCourse(EMPTY_PLAN, fall, course("a"), "backup");
		plan = addCourse(plan, fall, course("a"), "main");
		expect(ids(plan)).toEqual({ main: ["a"], backup: [] });
	});

	it("promotes a backup to main", () => {
		const plan = addCourse(EMPTY_PLAN, fall, course("a"), "backup");
		expect(ids(promoteBackup(plan, fall, "a"))).toEqual({
			main: ["a"],
			backup: [],
		});
	});

	it("ignores promoting a course that is not a backup", () => {
		const plan = addCourse(EMPTY_PLAN, fall, course("a"), "main");
		expect(promoteBackup(plan, fall, "missing")).toBe(plan);
	});

	it("demotes a main course to the backups", () => {
		const plan = addCourse(EMPTY_PLAN, fall, course("a"), "main");
		expect(ids(demoteToBackup(plan, fall, "a"))).toEqual({
			main: [],
			backup: ["a"],
		});
	});

	it("removes a course from either slot", () => {
		let plan = addCourse(EMPTY_PLAN, fall, course("a"), "main");
		plan = addCourse(plan, fall, course("b"), "backup");
		plan = removeCourse(removeCourse(plan, fall, "a"), fall, "b");
		expect(ids(plan)).toEqual({ main: [], backup: [] });
	});

	it("leaves the input untouched", () => {
		addCourse(EMPTY_PLAN, fall, course("a"), "main");
		expect(EMPTY_PLAN.semesters).toEqual({});
	});

	it("falls back to an empty plan for unknown stored shapes", () => {
		expect(readStoredPlan(null)).toBe(EMPTY_PLAN);
		expect(readStoredPlan({ version: 2 } as unknown as StoredPlan)).toBe(
			EMPTY_PLAN,
		);
	});
});

describe("findPlannedCourse", () => {
	it("finds the semester and slot a course is in", () => {
		let plan = addCourse(EMPTY_PLAN, fall, course("a"), "main");
		plan = addCourse(
			plan,
			{ studyYear: 4, term: "SPRING" },
			course("b"),
			"backup",
		);
		expect(findPlannedCourse(plan.semesters, "a")).toEqual({
			target: fall,
			slot: "main",
		});
		expect(findPlannedCourse(plan.semesters, "b")).toEqual({
			target: { studyYear: 4, term: "SPRING" },
			slot: "backup",
		});
		expect(findPlannedCourse(plan.semesters, "missing")).toBeNull();
	});
});

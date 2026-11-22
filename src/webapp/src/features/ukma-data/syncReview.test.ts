import { describe, expect, it } from "vitest";

import type { SyncPreviewResponse } from "@/lib/api/generated";
import { parseConflict, skipReasonLabel } from "./syncReasons";
import {
	approvalCounts,
	kindRisk,
	needsMoveTick,
	needsStaleTick,
	sameDay,
} from "./syncReview";

const preview = (
	overrides: Partial<SyncPreviewResponse> = {},
): SyncPreviewResponse => ({
	token: "7:abc",
	count: 28_950,
	counts: { link_offering: { apply: 28_950, wait: 0, superseded: 0 } },
	superseded_reasons: {},
	ratings_moved: 0,
	plans_moved: 0,
	field_counts: {},
	run_age_hours: 7,
	...overrides,
});

describe("ticks", () => {
	it("asks for a moves tick when ratings or plans move", () => {
		// Assert
		expect(needsMoveTick(preview())).toBe(false);
		expect(needsMoveTick(preview({ plans_moved: 1 }))).toBe(true);
	});

	it("asks for a stale tick past 48 hours", () => {
		// Assert
		expect(needsStaleTick(preview({ run_age_hours: 48 }))).toBe(false);
		expect(needsStaleTick(preview({ run_age_hours: 49 }))).toBe(true);
		expect(needsStaleTick(preview({ run_age_hours: null }))).toBe(false);
	});
});

describe("parseConflict", () => {
	it("reads the holder and the selection change", () => {
		// Arrange & Act
		const conflict = parseConflict({
			detail: "Список змінився: було 28950, стало 28940. Перегляньте ще раз",
			code: "selection_changed",
			status: 409,
			holder: "other_user",
			run_age_hours: 7,
		});

		// Assert
		expect(conflict).toEqual({
			detail: "Список змінився: було 28950, стало 28940. Перегляньте ще раз",
			selectionChanged: true,
			holder: "other_user",
			runAgeHours: 7,
		});
	});

	it("ignores an unknown holder and a body without a detail", () => {
		// Assert
		expect(parseConflict({ detail: "x", holder: "robot" })?.holder).toBeNull();
		expect(parseConflict("nope")).toBeNull();
	});
});

describe("small helpers", () => {
	it("reads approval counts and fills the missing ones with zero", () => {
		// Assert
		expect(approvalCounts({ applied: 3, rejected: 2 })).toEqual({
			applied: 3,
			waiting: 0,
			superseded: 0,
			skipped: 0,
			rejected: 2,
		});
		expect(approvalCounts(null).applied).toBe(0);
	});

	it("tells whether a time is on the same day", () => {
		// Arrange
		const now = new Date(2030, 8, 1, 12, 0);

		// Assert
		expect(sameDay(new Date(2030, 8, 1, 8, 0).toISOString(), now)).toBe(true);
		expect(sameDay(new Date(2030, 7, 31, 23, 0).toISOString(), now)).toBe(
			false,
		);
	});

	it("labels risks and reasons", () => {
		// Assert
		expect(kindRisk("merge_courses")).toBe("moves_ratings");
		expect(kindRisk("link_offering")).toBe("invisible");
		expect(kindRisk("new_course")).toBe("visible");
		expect(skipReasonLabel("no_term")).toBe("Немає семестру");
		expect(skipReasonLabel("brand_new")).toBe("brand_new");
	});
});

import { describe, expect, it } from "vitest";

import type { SyncPreviewResponse, SyncSummary } from "@/lib/api/generated";
import { parseConflict, skipReasonLabel } from "./syncReasons";
import {
	answersTotal,
	bulkLabel,
	confirmLabel,
	kindRisk,
	needsMoveTick,
	needsStaleTick,
	parseFacets,
	pendingParams,
	selectionFilter,
	stepTarget,
	titleDiff,
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
	run_age_hours: 7,
	...overrides,
});

const state = { kind: null, q: "", rated: false, similar: false };

describe("selectionFilter", () => {
	it("splits links by match", () => {
		// Arrange & Act
		const exact = selectionFilter("exact_links", state, "bulk");
		const review = selectionFilter("review_links", state, "bulk");

		// Assert
		expect(exact).toEqual({ group: "link", match: "exact" });
		expect(review).toEqual({ group: "link", match: "review" });
	});

	it("leaves similar new courses out of a bulk apply but not out of the list", () => {
		// Arrange
		const newCourses = { ...state, kind: "new_course" };

		// Act
		const bulk = selectionFilter("new_rows", newCourses, "bulk");
		const list = selectionFilter("new_rows", newCourses, "list");

		// Assert
		expect(bulk).toEqual({
			group: "new",
			kind: "new_course",
			similar_existing: false,
		});
		expect(list).toEqual({ group: "new", kind: "new_course" });
	});

	it("carries the search, the rated filter and the similar facet", () => {
		// Arrange & Act
		const filter = selectionFilter(
			"new_rows",
			{ kind: "new_course", q: " 315421 ", rated: true, similar: true },
			"list",
		);

		// Assert
		expect(filter).toEqual({
			group: "new",
			kind: "new_course",
			q: "315421",
			rated: true,
			similar_existing: true,
		});
	});
});

describe("pendingParams", () => {
	it("asks for a seeded sample of a pinned run", () => {
		// Arrange & Act
		const params = pendingParams(
			{ group: "link", match: "exact", kind: "link_offering" },
			{ source: "catalog", run: 3 },
			{ mode: "sample", seed: 2, page: 1, size: 50 },
		);

		// Assert
		expect(params).toEqual({
			source: "catalog",
			group: "link",
			match: "exact",
			kind: "link_offering",
			run: 3,
			view: "sample",
			seed: 2,
			page: 1,
			page_size: 50,
		});
	});

	it("drops the seed when listing all", () => {
		// Arrange & Act
		const params = pendingParams(
			{ group: "removed" },
			{ source: "catalog", run: null },
			{ mode: "all", seed: 2, page: 3, size: 50 },
		);

		// Assert
		expect(params).toEqual({
			source: "catalog",
			group: "removed",
			view: "all",
			page: 3,
			page_size: 50,
		});
	});
});

describe("confirmLabel", () => {
	it("names the links it applies", () => {
		// Arrange & Act
		const label = confirmLabel("exact_links", preview());

		// Assert
		expect(label).toBe("Застосувати 28\u00a0950 звʼязків");
	});

	it("puts moved ratings first", () => {
		// Arrange & Act
		const label = confirmLabel(
			"new_rows",
			preview({
				counts: { new_course: { apply: 11, wait: 2, superseded: 0 } },
				ratings_moved: 41,
			}),
		);

		// Assert
		expect(label).toBe("Перенести 41 оцінку й створити 11 записів");
	});

	it("marks removed rows as seen", () => {
		// Arrange & Act
		const label = confirmLabel(
			"removed",
			preview({
				counts: { removed_offering: { apply: 12, wait: 0, superseded: 0 } },
			}),
		);

		// Assert
		expect(label).toBe("Позначити 12 записів переглянутими");
	});
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
	it("routes question steps to the question entry", () => {
		// Assert
		expect(stepTarget("rated_questions")).toEqual({
			param: "question",
			value: "rated_questions",
		});
		expect(stepTarget("field_changes")).toEqual({
			param: "group",
			value: "field_changes",
		});
	});

	it("highlights only the differing middle of a title", () => {
		// Arrange & Act
		const diff = titleDiff(
			"Алгоритми і структури даних",
			"Алгоритми та структури даних",
		);

		// Assert
		expect(diff).toEqual({
			prefix: "Алгоритми ",
			changed: "та",
			suffix: " структури даних",
		});
	});

	it("names the bulk count and how many rows were seen", () => {
		// Assert
		expect(bulkLabel(24_120, 20)).toBe(
			"Застосувати всі 24\u00a0120 (переглянуто 20)…",
		);
		expect(bulkLabel(null, 3)).toBe(
			"Застосувати всі за фільтром (переглянуто 3)…",
		);
	});

	it("reads facets and answers", () => {
		// Arrange
		const summary: Pick<SyncSummary, "answers"> = {
			answers: { merge: 120, keep_apart: 60, keep: 0, place: 2, move: 1 },
		};

		// Act & Assert
		expect(parseFacets({ match: { exact: 3, review: 1 } })).toEqual({
			exact: 3,
			review: 1,
			similarExisting: null,
		});
		expect(parseFacets({ similar_existing: 12 }).similarExisting).toBe(12);
		expect(answersTotal(summary)).toBe(183);
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

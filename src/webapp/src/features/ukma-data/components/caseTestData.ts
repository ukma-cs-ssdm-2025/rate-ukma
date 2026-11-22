import type {
	UkmaDataReviewCase,
	UkmaDataReviewCasePage,
	UkmaDataStatus,
} from "@/lib/api/generated";

export const STATUS_URL = "/api/v1/ukma-data/status/";
export const CASES_URL = "/api/v1/ukma-data/review-cases/";

export const NOW = Date.parse("2030-09-10T12:00:00Z");

export const keyStatus: UkmaDataStatus = {
	key_id: "key-test-1",
	scopes: ["catalog:read", "review:read"],
	key_expires_at: "2031-01-01T00:00:00Z",
	data_updated_at: "2030-09-10T03:55:00Z",
};

export function studentCase(
	index: number,
	overrides: Partial<UkmaDataReviewCase> = {},
): UkmaDataReviewCase {
	return {
		id: `case-st-${index}`,
		kind: "student_match",
		subject_id: `rec-test-${index}`,
		candidates: { studentIds: ["stu-test-a", "stu-test-b"] },
		safe_answer: { studentId: "stu-test-a" },
		status: "open",
		run_id: null,
		decision_id: null,
		opened_at: "2030-09-02T10:00:00Z",
		change_no: index,
		...overrides,
	};
}

export const removalCase: UkmaDataReviewCase = {
	id: "case-rm-1",
	kind: "removals_held",
	subject_id: "run_77",
	candidates: {
		academicYear: 2029,
		offeringIds: ["off-test-1", "off-test-2", "off-test-3"],
	},
	safe_answer: { removals: "held" },
	status: "open",
	run_id: "77",
	decision_id: null,
	opened_at: "2030-09-09T10:00:00Z",
	change_no: 500,
};

export function casePage(
	items: readonly UkmaDataReviewCase[],
	overrides: Partial<UkmaDataReviewCasePage> = {},
): UkmaDataReviewCasePage {
	return {
		items: [...items],
		cursor: items.length,
		has_more: false,
		data_updated_at: "2030-09-10T03:55:00Z",
		total: items.length,
		...overrides,
	};
}

export const forbidden = {
	detail: "Key lacks the scope",
	code: "ukma_data_forbidden",
	status: 403,
};

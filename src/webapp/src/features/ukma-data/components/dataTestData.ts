import type {
	SyncApprovalDetail,
	SyncChange,
	SyncPendingResponse,
	SyncPolicy,
	SyncQuestion,
	SyncRun,
	SyncSummary,
	SyncSummaryStep,
	UkmaDataStatus,
} from "@/lib/api/generated";

export const NOW = Date.parse("2030-09-10T12:00:00Z");
export const API = "/api/v1/ukma-data";
export const SYNC_URL = `${API}/sync`;
export const STATUS_URL = `${API}/status/`;
export const CASES_URL = `${API}/review-cases/`;
export const SUMMARY_URL = `${SYNC_URL}/summary/`;
export const RUNS_URL = `${SYNC_URL}/runs/`;
export const PENDING_URL = `${SYNC_URL}/pending/`;
export const QUESTIONS_URL = `${SYNC_URL}/questions/`;
export const POLICIES_URL = `${SYNC_URL}/policies/`;
export const POLICY_CHANGES_URL = `${SYNC_URL}/policies/changes/`;
export const approvalsUrl = (run: number) =>
	`${SYNC_URL}/runs/${run}/approvals/`;

export const listPage = <T>(items: T[], total = items.length) => ({
	items,
	page: 1,
	page_size: 20,
	total,
	total_pages: Math.max(1, Math.ceil(total / 20)),
	next_page: total > 20 ? 2 : null,
	previous_page: null,
});

export const keyStatus: UkmaDataStatus = {
	key_id: "key-test-0001",
	scopes: ["catalog:read", "review:read"],
	decide_scopes: [],
	key_expires_at: "2030-12-01T00:00:00Z",
	data_updated_at: "2030-09-10T06:10:00Z",
};

export const keyStatusWithDecide: UkmaDataStatus = {
	...keyStatus,
	decide_scopes: ["catalog:read", "review:decide"],
};

export const run: SyncRun = {
	id: 7,
	source: "catalog",
	status: "succeeded",
	started_at: "2030-09-10T08:51:00Z",
	finished_at: "2030-09-10T09:00:00Z",
	cursor_from: {},
	cursor_to: {},
	cursor_saved: {},
	data_updated_at: "2030-09-10T06:10:00Z",
	counts: { change: { proposed: 150 } },
	error: "",
	age_seconds: 10_800,
};

export const failedRun: SyncRun = {
	...run,
	id: 8,
	status: "failed",
	started_at: "2030-09-10T11:00:00Z",
	finished_at: "2030-09-10T11:02:00Z",
	error: "short_read",
};

const step = (
	name: string,
	group: SyncSummaryStep["group"],
	kinds: Record<string, number>,
	rated = 0,
): SyncSummaryStep => ({
	step: name,
	group,
	kinds,
	count: Object.values(kinds).reduce((sum, count) => sum + count, 0),
	rated,
	ratings: 0,
	plans: 0,
	waiting: 0,
	facets: {},
});

export const summary: SyncSummary = {
	run,
	newer_run_id: null,
	groups: {
		links: {
			courses: 290,
			offerings: 11,
			faculties: 0,
			departments: 0,
			total: 301,
		},
		new: {
			courses: 40,
			offerings: 772,
			faculties: 0,
			departments: 0,
			total: 812,
		},
		changes: { total: 150, offerings: 12, by_field: [], blanking: [] },
		merges: { total: 15, rated: 3, ratings: 9, unrated: 12 },
		placements: { total: 3, place: 2, move: 1 },
		removed: { total: 3 },
		other: { total: 0 },
	},
	steps: [
		step("new_rows", "new", { new_course: 40, new_offering: 772 }),
		step("exact_links", "link", { link_course: 290, link_offering: 11 }),
		step(
			"field_changes",
			"change",
			{ change_course: 138, change_offering: 12 },
			4,
		),
		step("rated_questions", "mapping", { merge_courses: 3 }, 3),
		step("other_questions", "mapping", {
			merge_courses: 12,
			place_offering: 3,
		}),
		step("removed", "removed", { removed_offering: 3 }),
	],
	answers: { merge: 0, keep_apart: 2, keep: 0, place: 0, move: 0 },
	not_proposed: {
		no_term: { count: 5, rated: 0 },
		zero_credits: { count: 2, rated: 0 },
	},
};

export const emptySummary: SyncSummary = {
	...summary,
	steps: summary.steps.map((item) => ({
		...item,
		kinds: {},
		count: 0,
		rated: 0,
	})),
	not_proposed: {},
};

export const approval: SyncApprovalDetail = {
	id: 73,
	run_id: 7,
	action: "apply",
	scope: "group",
	group: "change",
	kind: "",
	outcome: "applied",
	counts: { applied: 140, superseded: 2, waiting: 0 },
	error: "",
	user_email: "o.testenko@ukma.edu.ua",
	created_at: "2030-09-10T09:00:00Z",
	selection: "Зміни, 142 зміни",
	ratings_moved: 0,
	plans_moved: 0,
	merged: [],
};

export const rejection: SyncApprovalDetail = {
	...approval,
	id: 74,
	action: "reject",
	counts: { rejected: 1, superseded: 0 },
	selection: "Зміни, 1 зміна",
	created_at: "2030-09-10T10:00:00Z",
};

export const titleChange: SyncChange = {
	id: 48_121,
	run_id: 7,
	source: "catalog",
	group: "change",
	kind: "change_course",
	key: "course-test-1",
	ukma_data_id: "ud-course-test-1",
	target_id: "course-test-1",
	before: { title: "Тестова дисципліна А" },
	after: { title: "Тестова дисципліна Б" },
	waiting_on: [],
	ratings: 12,
	state: "proposed",
	state_reason: "",
	never_auto: false,
	decided_at: null,
};

export const pending = (
	items: SyncChange[],
	total = items.length,
): SyncPendingResponse => ({
	...listPage(items, total),
	groups: { new: 812, link: 301, change: 150, mapping: 18, removed: 3 },
	kinds: {},
	runs: [run],
});

export const question: SyncQuestion = {
	id: 50_011,
	kind: "merge_courses",
	key: "ud-course-test-9",
	ukma_data_id: "ud-course-test-9",
	ukma_title: "Тестова дисципліна В",
	ukma_department: "Кафедра прикладу",
	offering: null,
	move_into: null,
	ratings: 0,
	plans: 0,
	courses: [
		{
			id: "course-test-2",
			title: "Тестова дисципліна В",
			department: "Кафедра прикладу",
			years: [2029],
			offerings: [],
			ratings: 0,
			plans: 0,
			title_matches_ukma: true,
			holds_ukma_id: true,
			url: "/courses/course-test-2",
		},
		{
			id: "course-test-3",
			title: "Тестова дисципліна В",
			department: "Кафедра зразка",
			years: [2027],
			offerings: [],
			ratings: 0,
			plans: 0,
			title_matches_ukma: true,
			holds_ukma_id: false,
			url: "/courses/course-test-3",
		},
	],
	suggested_into: "course-test-2",
	answer: null,
};

const policy = (
	kind: string,
	group: SyncPolicy["group"],
	extra: Partial<SyncPolicy> = {},
): SyncPolicy => ({
	kind,
	source: "catalog",
	group,
	mode: "needs_approval",
	never_auto: false,
	updated_by: null,
	updated_at: null,
	...extra,
});

export const policies: SyncPolicy[] = [
	policy("new_course", "new"),
	policy("change_course", "change", {
		mode: "auto",
		updated_by: 1,
		updated_at: "2030-09-08T12:00:00Z",
	}),
	policy("merge_courses", "mapping", { never_auto: true }),
];

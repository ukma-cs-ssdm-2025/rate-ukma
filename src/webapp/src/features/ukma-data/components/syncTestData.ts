import type {
	SyncApprovalDetail,
	SyncChange,
	SyncPendingResponse,
	SyncPreviewResponse,
	SyncRun,
	SyncSummary,
	SyncSummaryStep,
} from "@/lib/api/generated";

export const SYNC_URL = "/api/v1/ukma-data/sync";

export const listPage = <T>(items: T[], total = items.length) => ({
	items,
	page: 1,
	page_size: 50,
	total,
	total_pages: 1,
	next_page: null,
	previous_page: null,
});

export const catalogRun: SyncRun = {
	id: 7,
	source: "catalog",
	status: "succeeded",
	started_at: "2030-09-01T00:30:00Z",
	finished_at: "2030-09-01T00:42:00Z",
	cursor_from: {},
	cursor_to: {},
	cursor_saved: {},
	data_updated_at: "2030-09-01T00:10:00Z",
	counts: { link: { proposed: 29_406 } },
	error: "",
	age_seconds: 25_200,
};

const step = (
	name: string,
	group: SyncSummaryStep["group"],
	kinds: Record<string, number>,
	extra: Partial<SyncSummaryStep> = {},
): SyncSummaryStep => ({
	step: name,
	group,
	kinds,
	count: Object.values(kinds).reduce((sum, count) => sum + count, 0),
	rated: 0,
	ratings: 0,
	plans: 0,
	waiting: 0,
	facets: {},
	...extra,
});

export const catalogSummary: SyncSummary = {
	run: catalogRun,
	newer_run_id: null,
	steps: [
		step(
			"exact_links",
			"link",
			{ link_offering: 24_120, link_course: 4830 },
			{
				facets: { match: { exact: 28_950, review: 456 } },
			},
		),
		step(
			"rated_questions",
			"mapping",
			{ merge_courses: 11 },
			{
				rated: 11,
				ratings: 41,
				plans: 3,
			},
		),
		step("other_questions", "mapping", {
			merge_courses: 174,
			place_offering: 23,
			move_offering: 5,
		}),
		step("review_links", "link", { link_offering: 170, link_course: 286 }),
		step(
			"new_rows",
			"new",
			{ new_offering: 681, new_course: 178 },
			{
				waiting: 47,
				facets: { similar_existing: 12 },
			},
		),
		step("field_changes", "change", { change_offering: 1855 }),
		step("removed", "removed", { removed_offering: 12 }),
	],
	answers: { merge: 0, keep_apart: 0, keep: 0, place: 0, move: 0 },
	not_proposed: {
		no_term: { count: 1102, rated: 4 },
		title_too_long: { count: 132, rated: 0 },
	},
};

export const emptySummary: SyncSummary = {
	...catalogSummary,
	steps: catalogSummary.steps.map((item) => ({ ...item, kinds: {}, count: 0 })),
	not_proposed: {},
};

export const linkChange: SyncChange = {
	id: 101,
	run_id: 7,
	source: "catalog",
	group: "link",
	kind: "link_course",
	key: "ud-course-101",
	ukma_data_id: "ud-course-101",
	target_id: "course-101",
	before: {},
	after: {
		ukma_data_id: "ud-course-101",
		majority_share: 1,
		display: {
			course: {
				title: "Основи числових методів",
				department: "Кафедра прикладних обчислень",
				years: [2021, 2025],
				saz_codes: ["315421"],
				teachers: [],
			},
			ukma_course: { title: "Основи чисельних методів" },
		},
	},
	waiting_on: [],
	ratings: 3,
	state: "proposed",
	state_reason: "",
	never_auto: false,
	decided_at: null,
};

export const pendingLinks: SyncPendingResponse = {
	...listPage([linkChange], 4830),
	groups: { link: 29_406 },
	kinds: { link_offering: 24_290, link_course: 5116 },
	runs: [catalogRun],
};

export const linksPreview: SyncPreviewResponse = {
	token: "7:5f1c",
	count: 4830,
	counts: { link_course: { apply: 4828, wait: 0, superseded: 2 } },
	superseded_reasons: { stale: 2 },
	ratings_moved: 0,
	plans_moved: 0,
	run_age_hours: 7,
};

export const appliedApproval: SyncApprovalDetail = {
	id: 31,
	run_id: 7,
	action: "apply",
	scope: "group",
	group: "link",
	kind: "link_course",
	outcome: "applied",
	counts: { applied: 4828, superseded: 2, waiting: 0 },
	error: "",
	user_email: "reviewer@example.invalid",
	created_at: "2030-09-01T07:42:00Z",
	selection: "Звʼязки з точним збігом: курси",
	ratings_moved: 0,
	plans_moved: 0,
	merged: [],
};

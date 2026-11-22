import type {
	SyncApprovalDetail,
	SyncChange,
	SyncPendingResponse,
	SyncPreviewResponse,
	SyncQuestion,
	SyncQuestionCourse,
	SyncRun,
	SyncSummary,
	SyncSummaryGroups,
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

export const catalogGroups: SyncSummaryGroups = {
	links: {
		courses: 5116,
		offerings: 24_290,
		faculties: 6,
		departments: 45,
		total: 29_457,
	},
	new: {
		courses: 178,
		offerings: 681,
		faculties: 1,
		departments: 3,
		total: 863,
	},
	changes: {
		total: 1855,
		offerings: 1855,
		by_field: [
			{
				field: "practice_type",
				count: 1045,
				pairs: [{ before: "PRACTICE", after: "SEMINAR", count: 1045 }],
			},
			{
				field: "credits",
				count: 4,
				pairs: [{ before: "2.5", after: "2.0", count: 4 }],
			},
			{
				field: "term",
				count: 2,
				pairs: [{ before: "SPRING", after: "FALL", count: 2 }],
			},
		],
		blanking: [
			{
				field: "practice_type",
				count: 892,
				pairs: [{ before: "PRACTICE", after: "", count: 892 }],
			},
		],
	},
	merges: { total: 185, rated: 10, ratings: 34, unrated: 175 },
	placements: { total: 28, place: 23, move: 5 },
	removed: { total: 0 },
	other: { total: 0 },
};

export const doneGroups: SyncSummaryGroups = {
	links: { courses: 0, offerings: 0, faculties: 0, departments: 0, total: 0 },
	new: { courses: 0, offerings: 0, faculties: 0, departments: 0, total: 0 },
	changes: { total: 0, offerings: 0, by_field: [], blanking: [] },
	merges: { total: 0, rated: 0, ratings: 0, unrated: 0 },
	placements: { total: 0, place: 0, move: 0 },
	removed: { total: 0 },
	other: { total: 0 },
};

export const catalogSummary: SyncSummary = {
	run: catalogRun,
	newer_run_id: null,
	groups: catalogGroups,
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
	groups: doneGroups,
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
	field_counts: {},
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

export const course = (
	overrides: Partial<SyncQuestionCourse> = {},
): SyncQuestionCourse => ({
	id: "00000000-0000-4000-8000-000000000001",
	title: "Основи мережевих протоколів",
	department: "Кафедра обчислювальних мереж",
	years: [2023, 2025],
	offerings: [
		{ saz_code: "900101", year: 2023, term: "FALL", ratings: 3 },
		{ saz_code: "900102", year: 2024, term: "FALL", ratings: 5 },
		{ saz_code: "900103", year: 2025, term: "FALL", ratings: 0 },
	],
	ratings: 8,
	plans: 0,
	title_matches_ukma: true,
	holds_ukma_id: false,
	url: "/courses/00000000-0000-4000-8000-000000000001",
	...overrides,
});

export const otherCourse = course({
	id: "00000000-0000-4000-8000-000000000002",
	department: "Кафедра мережевих систем",
	offerings: [{ saz_code: "900201", year: 2027, term: "SPRING", ratings: 0 }],
	ratings: 0,
	url: "/courses/00000000-0000-4000-8000-000000000002",
});

export const mergeQuestion = (
	overrides: Partial<SyncQuestion> = {},
): SyncQuestion => ({
	id: 501,
	kind: "merge_courses",
	key: "merge-501",
	ukma_data_id: null,
	ukma_title: "Основи мережевих протоколів",
	ukma_department: "Кафедра мережевих систем",
	offering: null,
	move_into: null,
	ratings: 8,
	plans: 0,
	courses: [course(), otherCourse],
	suggested_into: course().id,
	answer: null,
	...overrides,
});

export const placeQuestion = (
	overrides: Partial<SyncQuestion> = {},
): SyncQuestion => ({
	...mergeQuestion(),
	id: 601,
	kind: "place_offering",
	key: "place-601",
	ukma_title: "Бренд-стратегії",
	ukma_department: null,
	offering: { saz_code: "934493", year: 2019, term: "FALL" },
	courses: [
		course({ title: "Бренд-стратегії", ratings: 0 }),
		{ ...otherCourse, title: "Бренд-стратегії" },
	],
	suggested_into: null,
	...overrides,
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { authorizedHttpClient } from "@/lib/api/apiClient";
import type {
	SyncChange,
	SyncChangeListResponse,
	SyncPendingResponse,
	SyncPolicy,
	SyncPolicyChangeListResponse,
	SyncPolicyListResponse,
	SyncRun,
	SyncRunListResponse,
} from "@/lib/api/generated";
import { SyncPage } from "./SyncPage";

const PENDING_URL = "/api/v1/ukma-data/sync/pending/";
const RUNS_URL = "/api/v1/ukma-data/sync/runs/";
const RUN_CHANGES_URL = "/api/v1/ukma-data/sync/runs/7/changes/";
const POLICIES_URL = "/api/v1/ukma-data/sync/policies/";
const POLICY_CHANGES_URL = "/api/v1/ukma-data/sync/policies/changes/";
const APPROVE_URL = "/api/v1/ukma-data/sync/approve/";
const REJECT_URL = "/api/v1/ukma-data/sync/reject/";
const ANSWER_URL = "/api/v1/ukma-data/sync/changes/13/answer/";
const KEEP_APART_URL = "/api/v1/ukma-data/sync/mapping/keep-apart-unrated/";

const catalogRun: SyncRun = {
	id: 7,
	source: "catalog",
	status: "succeeded",
	started_at: "2030-09-01T06:00:00Z",
	finished_at: "2030-09-01T06:02:00Z",
	cursor_from: {},
	cursor_to: {},
	cursor_saved: {},
	data_updated_at: "2030-09-01T05:00:00Z",
	counts: { new: { proposed: 2 }, link: { applied: 5 } },
	error: "",
	age_seconds: 3600,
};

const teacherRun: SyncRun = {
	...catalogRun,
	id: 8,
	source: "teachers",
	counts: { change: { proposed: 1 } },
};

const courseChange: SyncChange = {
	id: 11,
	run_id: 7,
	source: "catalog",
	group: "new",
	kind: "new_course",
	key: "ud-course-1",
	ukma_data_id: "ud-course-1",
	target_id: null,
	before: {},
	after: {
		title: "Аналіз даних",
		level: "MASTER",
		display: {
			course: {
				title: "Аналіз даних",
				department: "Кафедра зразків",
				years: [2030, 2031],
				saz_codes: ["TEST01"],
			},
		},
	},
	waiting_on: [],
	ratings: 2,
	state: "proposed",
	state_reason: "",
	never_auto: false,
	decided_at: null,
};

const teacherChange: SyncChange = {
	id: 12,
	run_id: 8,
	source: "teachers",
	group: "change",
	kind: "teacher_link_added",
	key: "offering:test-1|teacher:test@example.invalid|role:LECTURER",
	ukma_data_id: null,
	target_id: "offering-1",
	before: { links: [] },
	after: {
		teacher_email: "test@example.invalid",
		role: "LECTURER",
		display: { teacher: { name: "Тестовий Викладач" } },
	},
	waiting_on: [],
	ratings: 0,
	state: "proposed",
	state_reason: "",
	never_auto: false,
	decided_at: null,
};

const mappingChange: SyncChange = {
	id: 13,
	run_id: 7,
	source: "catalog",
	group: "mapping",
	kind: "merge_courses",
	key: "ud-course-2",
	ukma_data_id: "ud-course-2",
	target_id: null,
	before: {},
	after: {
		merge_source: "handoff",
		courses: [],
		display: {
			courses: [
				{
					title: "Суміжний курс",
					department: "Кафедра тестів",
					years: [2030],
					saz_codes: ["TEST02"],
				},
			],
		},
	},
	waiting_on: [],
	ratings: 1,
	state: "proposed",
	state_reason: "",
	never_auto: true,
	decided_at: null,
};

const removedChange: SyncChange = {
	id: 15,
	run_id: 7,
	source: "catalog",
	group: "removed",
	kind: "removed_offering",
	key: "ru-offering-1",
	ukma_data_id: null,
	target_id: "ru-offering-1",
	before: {},
	after: {
		saz_code: "TEST09",
		display: {
			course: {
				title: "Вилучена вибірка",
				department: "Кафедра тестів",
				years: [2030],
				saz_codes: ["TEST09"],
			},
		},
	},
	waiting_on: [],
	ratings: 0,
	state: "proposed",
	state_reason: "",
	never_auto: false,
	decided_at: null,
};

const page = <T,>(items: T[]) => ({
	items,
	page: 1,
	page_size: 20,
	total: items.length,
	total_pages: 1,
	next_page: null,
	previous_page: null,
});

const pending: SyncPendingResponse = {
	...page([courseChange, teacherChange, mappingChange]),
	groups: { new: 1, change: 1, mapping: 1 },
	kinds: { new_course: 1, teacher_link_added: 1, merge_courses: 1 },
	runs: [teacherRun, catalogRun],
};

const runs: SyncRunListResponse = page([catalogRun, teacherRun]);

const policies: SyncPolicy[] = [
	{
		kind: "new_faculty",
		source: "catalog",
		group: "new",
		mode: "needs_approval",
		never_auto: false,
		updated_by: null,
		updated_at: null,
	},
	{
		kind: "merge_courses",
		source: "catalog",
		group: "mapping",
		mode: "needs_approval",
		never_auto: true,
		updated_by: null,
		updated_at: null,
	},
];

const policyChanges: SyncPolicyChangeListResponse = page([]);
const runChanges: SyncChangeListResponse = page([
	{ ...courseChange, state: "applied" },
]);

let mockAxios: MockAdapter;

function renderPage(search = "", onUrlUpdate?: () => void) {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	render(
		<QueryClientProvider client={queryClient}>
			<NuqsTestingAdapter
				searchParams={search}
				hasMemory
				onUrlUpdate={onUrlUpdate}
			>
				<SyncPage />
			</NuqsTestingAdapter>
		</QueryClientProvider>,
	);
	return { queryClient };
}

const approval = {
	id: 1,
	action: "apply" as const,
	outcome: "applied" as const,
	counts: { applied: 1, superseded: 0, waiting: 0, skipped: 0 },
	error: "",
};

const approvalWith = (counts: Record<string, number>) => ({
	...approval,
	counts,
});

function mockPending(data: SyncPendingResponse = pending) {
	mockAxios.onGet(PENDING_URL).reply(200, data);
}

beforeEach(() => {
	mockAxios = new MockAdapter(authorizedHttpClient);
});

afterEach(() => {
	mockAxios.restore();
});

describe("sync section", () => {
	it("renders the pending tab from the API grouped by source and group", async () => {
		mockPending();

		renderPage("?tab=pending");

		const catalog = await screen.findByRole("list", {
			name: "Каталог: Нові записи",
		});
		expect(within(catalog).getAllByText("Аналіз даних").length).toBeGreaterThan(
			0,
		);
		expect(within(catalog).getByText(/САЗ TEST01/)).toBeInTheDocument();
		expect(within(catalog).getByText("2 оцінки")).toBeInTheDocument();
		expect(screen.getByText("Потрібне підтвердження")).toBeInTheDocument();
		expect(
			screen.getByRole("list", { name: "Викладачі: Вибірка" }),
		).toHaveTextContent("Тестовий Викладач");
		expect(screen.getAllByText(/дані UKMA Data/)).toHaveLength(2);
		expect(screen.getByText("Очікують підтвердження: 3")).toBeInTheDocument();
		expect(mockAxios.history.get[0].params).toEqual({
			page: 1,
			page_size: 20,
		});
	});

	it("asks for the group, kind and page in the URL", async () => {
		mockPending();

		renderPage("?tab=pending&group=new&kind=new_course&page=2");

		await screen.findByRole("list", { name: "Каталог: Нові записи" });
		expect(mockAxios.history.get[0].params).toEqual({
			page: 2,
			page_size: 20,
			group: "new",
			kind: "new_course",
		});
	});

	it("shows empty states before the first run", async () => {
		mockPending({
			...page([]),
			groups: {},
			kinds: {},
			runs: [],
		});

		renderPage("?tab=pending");

		expect(
			await screen.findByText("Немає змін, що очікують"),
		).toBeInTheDocument();
		expect(
			screen.getByText("Ще немає успішних запусків синхронізації."),
		).toBeInTheDocument();
	});

	it("shows the error state when the pending request fails", async () => {
		mockAxios.onGet(PENDING_URL).reply(500, { detail: "x", status: 500 });

		renderPage("?tab=pending");

		expect(
			await screen.findByText("Не вдалося завантажити зміни"),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Спробувати знову" }),
		).toBeInTheDocument();
	});

	it("opens a run from history and shows its changes", async () => {
		const user = userEvent.setup();
		mockAxios.onGet(RUNS_URL).reply(200, runs);
		mockAxios.onGet(RUN_CHANGES_URL).reply(200, runChanges);

		renderPage("?tab=history");

		const list = await screen.findByRole("list", {
			name: "Запуски синхронізації",
		});
		expect(
			within(list).getByText(/Нові записи · Очікує: 2/),
		).toBeInTheDocument();
		await user.click(within(list).getAllByRole("button")[0]);

		expect(
			await screen.findByRole("list", { name: "Зміни запуску 7" }),
		).toHaveTextContent("Застосовано");
		expect(mockAxios.history.get.at(-1)?.params).toEqual({
			page: 1,
			page_size: 20,
		});
	});

	it("filters a run's changes by state from the URL", async () => {
		mockAxios.onGet(RUN_CHANGES_URL).reply(200, runChanges);

		renderPage("?tab=history&run=7&changesState=applied");

		await screen.findByRole("list", { name: "Зміни запуску 7" });
		expect(mockAxios.history.get[0].params).toEqual({
			state: "applied",
			page: 1,
			page_size: 20,
		});
	});

	it("opens a run on its first page whatever page the runs list is on", async () => {
		const user = userEvent.setup();
		mockAxios.onGet(RUNS_URL).reply(200, runs);
		mockAxios.onGet(RUN_CHANGES_URL).reply(200, runChanges);

		renderPage("?tab=history&runsPage=2&changesPage=3&changesState=rejected");

		const list = await screen.findByRole("list", {
			name: "Запуски синхронізації",
		});
		expect(mockAxios.history.get[0].params).toMatchObject({ page: 2 });
		await user.click(within(list).getAllByRole("button")[0]);

		await screen.findByRole("list", { name: "Зміни запуску 7" });
		expect(mockAxios.history.get.at(-1)?.params).toEqual({
			page: 1,
			page_size: 20,
		});
	});

	it("names a lone candidate course of a place question", async () => {
		const placeChange: SyncChange = {
			...mappingChange,
			id: 14,
			kind: "place_offering",
			key: "ud-offering-1",
			after: {
				display: {
					ukma_course: { title: "Курс у UKMA Data", department: null },
					courses: [
						{
							title: "Кандидат",
							department: "Кафедра тестів",
							years: [2030],
							saz_codes: ["TEST03"],
						},
					],
				},
			},
		};
		mockPending({
			...pending,
			...page([placeChange]),
			groups: { mapping: 1 },
			kinds: { place_offering: 1 },
		});

		renderPage();

		expect(await screen.findByText("Курс у UKMA Data")).toBeInTheDocument();
		expect(screen.getByText(/^Кандидат/)).toBeInTheDocument();
	});

	it("lists policies and disables the toggle for a never-auto kind", async () => {
		mockAxios
			.onGet(POLICIES_URL)
			.reply(200, { items: policies } satisfies SyncPolicyListResponse);
		mockAxios.onGet(POLICY_CHANGES_URL).reply(200, policyChanges);

		renderPage("?tab=rules");

		expect(
			screen.getByText(
				"Питання зіставлення та зміни, що переносять оцінки, завжди потребують підтвердження.",
			),
		).toBeInTheDocument();
		expect(
			await screen.findByRole("button", {
				name: "Змінити режим: Новий факультет",
			}),
		).toBeEnabled();
		expect(
			screen.getByRole("button", { name: "Змінити режим: Обʼєднання курсів" }),
		).toBeDisabled();
	});

	it("sends the PUT after the confirm dialog", async () => {
		const user = userEvent.setup();
		mockAxios.onGet(POLICIES_URL).reply(200, { items: policies });
		mockAxios.onGet(POLICY_CHANGES_URL).reply(200, policyChanges);
		mockAxios
			.onPut("/api/v1/ukma-data/sync/policies/new_faculty/")
			.reply(200, { ...policies[0], mode: "auto" });

		renderPage("?tab=rules");

		await user.click(
			await screen.findByRole("button", {
				name: "Змінити режим: Новий факультет",
			}),
		);
		expect(screen.getByText("Змінити правило?")).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "Змінити" }));

		await waitFor(() => expect(mockAxios.history.put).toHaveLength(1));
		expect(mockAxios.history.put[0].url).toBe(
			"/api/v1/ukma-data/sync/policies/new_faculty/",
		);
		expect(JSON.parse(mockAxios.history.put[0].data)).toEqual({
			mode: "auto",
		});
	});

	it("shows the API's 400 message when a policy change is refused", async () => {
		const user = userEvent.setup();
		mockAxios.onGet(POLICIES_URL).reply(200, { items: policies });
		mockAxios.onGet(POLICY_CHANGES_URL).reply(200, policyChanges);
		mockAxios.onPut("/api/v1/ukma-data/sync/policies/new_faculty/").reply(400, {
			detail: "Validation failed",
			status: 400,
			fields: { mode: ["Цей тип не можна зробити автоматичним."] },
		});

		renderPage("?tab=rules");

		await user.click(
			await screen.findByRole("button", {
				name: "Змінити режим: Новий факультет",
			}),
		);
		await user.click(screen.getByRole("button", { name: "Змінити" }));

		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Цей тип не можна зробити автоматичним.",
		);
	});

	it("approves one row and refreshes the pending list", async () => {
		const user = userEvent.setup();
		mockPending();
		mockAxios.onPost(APPROVE_URL).reply(200, approval);
		const { queryClient } = renderPage("?tab=pending");
		const invalidate = vi.spyOn(queryClient, "invalidateQueries");

		const catalog = await screen.findByRole("list", {
			name: "Каталог: Нові записи",
		});
		await user.click(
			within(catalog).getByRole("button", { name: "Підтвердити" }),
		);

		await waitFor(() => expect(mockAxios.history.post).toHaveLength(1));
		expect(JSON.parse(mockAxios.history.post[0].data)).toEqual({
			source: "catalog",
			group: "new",
			kind: "new_course",
			change_ids: [11],
			dry_run: false,
			confirm_stale: false,
		});
		expect(invalidate).toHaveBeenCalledWith({
			queryKey: ["/api/v1/ukma-data/sync/pending/"],
		});
		expect(invalidate).toHaveBeenCalledWith({
			queryKey: ["/api/v1/ukma-data/sync/runs/"],
		});
	});

	it("previews a group before applying it", async () => {
		const user = userEvent.setup();
		mockPending();
		mockAxios
			.onPost(APPROVE_URL)
			.replyOnce(200, approvalWith({ applied: 2, superseded: 1, waiting: 0 }))
			.onPost(APPROVE_URL)
			.replyOnce(200, approvalWith({ applied: 2, superseded: 0, waiting: 0 }));

		renderPage("?tab=pending");

		await user.click(
			await screen.findByRole("button", {
				name: "Переглянути й застосувати групу: Нові записи",
			}),
		);

		expect(
			await screen.findByText("Переглянути перед застосуванням"),
		).toBeInTheDocument();
		expect(screen.getByText(/Застосується: 2/)).toBeInTheDocument();
		expect(JSON.parse(mockAxios.history.post[0].data)).toMatchObject({
			source: "catalog",
			group: "new",
			kind: null,
			dry_run: true,
			confirm_stale: false,
		});

		await user.click(screen.getByRole("button", { name: "Застосувати" }));

		await waitFor(() => expect(mockAxios.history.post).toHaveLength(2));
		expect(JSON.parse(mockAxios.history.post[1].data)).toMatchObject({
			source: "catalog",
			group: "new",
			dry_run: false,
			confirm_stale: false,
		});
	});

	it("asks to confirm a run older than 48 hours and resends with confirm_stale", async () => {
		const user = userEvent.setup();
		mockPending();
		mockAxios
			.onPost(APPROVE_URL)
			.replyOnce(409, {
				detail: "Дані старші за 48 год (51 год)",
				status: 409,
			})
			.onPost(APPROVE_URL)
			.replyOnce(200, approval);

		renderPage("?tab=pending");

		const catalog = await screen.findByRole("list", {
			name: "Каталог: Нові записи",
		});
		await user.click(
			within(catalog).getByRole("button", { name: "Підтвердити" }),
		);

		expect(
			await screen.findByRole("heading", { name: "Дані старші за 48 год" }),
		).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "Продовжити" }));

		await waitFor(() => expect(mockAxios.history.post).toHaveLength(2));
		expect(JSON.parse(mockAxios.history.post[1].data)).toMatchObject({
			change_ids: [11],
			dry_run: false,
			confirm_stale: true,
		});
	});

	it("shows the lock message when a sync is already running", async () => {
		const user = userEvent.setup();
		mockPending();
		mockAxios
			.onPost(APPROVE_URL)
			.reply(409, { detail: "Синхронізація саме триває", status: 409 });

		renderPage("?tab=pending");

		const catalog = await screen.findByRole("list", {
			name: "Каталог: Нові записи",
		});
		await user.click(
			within(catalog).getByRole("button", { name: "Підтвердити" }),
		);

		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Синхронізація саме триває",
		);
	});

	it("rejects one row", async () => {
		const user = userEvent.setup();
		mockPending();
		mockAxios.onPost(REJECT_URL).reply(200, {
			...approval,
			action: "reject",
			counts: { rejected: 1, superseded: 0 },
		});

		renderPage("?tab=pending");

		const teachers = await screen.findByRole("list", {
			name: "Викладачі: Вибірка",
		});
		await user.click(
			within(teachers).getByRole("button", { name: "Відхилити" }),
		);

		await waitFor(() => expect(mockAxios.history.post).toHaveLength(1));
		expect(JSON.parse(mockAxios.history.post[0].data)).toEqual({
			change_ids: [12],
		});
	});

	it("answers a mapping question", async () => {
		const user = userEvent.setup();
		mockPending();
		mockAxios.onPost(ANSWER_URL).reply(200, {
			decision_id: 3,
			change_id: 13,
			kind: "merge_courses",
			answer: "keep_apart",
			ratings: 1,
		});

		renderPage("?tab=pending");

		const mapping = await screen.findByRole("list", {
			name: "Каталог: Зіставлення",
		});
		await user.click(
			within(mapping).getByRole("button", { name: "Залишити окремо" }),
		);

		await waitFor(() => expect(mockAxios.history.post).toHaveLength(1));
		expect(mockAxios.history.post[0].url).toBe(ANSWER_URL);
		expect(JSON.parse(mockAxios.history.post[0].data)).toEqual({
			answer: "keep_apart",
		});
	});

	it("acknowledges a removed row without a reject control", async () => {
		const user = userEvent.setup();
		mockPending({
			...pending,
			...page([removedChange]),
			groups: { removed: 1 },
			kinds: { removed_offering: 1 },
		});
		mockAxios.onPost(APPROVE_URL).reply(200, approval);

		renderPage("?tab=pending");

		const removed = await screen.findByRole("list", {
			name: "Каталог: Вилучення",
		});
		expect(
			within(removed).queryByRole("button", { name: "Відхилити" }),
		).toBeNull();
		await user.click(
			within(removed).getByRole("button", { name: "Позначити переглянутим" }),
		);

		await waitFor(() => expect(mockAxios.history.post).toHaveLength(1));
		expect(JSON.parse(mockAxios.history.post[0].data)).toEqual({
			source: "catalog",
			group: "removed",
			kind: "removed_offering",
			change_ids: [15],
			dry_run: false,
			confirm_stale: false,
		});
	});

	it("keeps teacher changes of one offering in one unit", async () => {
		const secondTeacher: SyncChange = {
			...teacherChange,
			id: 16,
			key: "offering:test-1|teacher:other@example.invalid|role:SEMINAR",
			after: {
				teacher_email: "other@example.invalid",
				role: "SEMINAR",
				display: { teacher: { name: "Інший Викладач" } },
			},
		};
		mockPending({
			...pending,
			...page([teacherChange, secondTeacher]),
			groups: { change: 2 },
			kinds: { teacher_link_added: 2 },
		});

		renderPage("?tab=pending");

		expect(
			await screen.findByText(
				"Зміни викладачів однієї вибірки застосовуються разом.",
			),
		).toBeInTheDocument();
		const unit = screen.getByRole("list", { name: "Викладачі: Вибірка" });
		expect(
			within(unit).getAllByRole("button", { name: "Підтвердити" }),
		).toHaveLength(2);
		expect(
			screen.getByRole("button", { name: "Підтвердити вибірку" }),
		).toBeInTheDocument();
	});

	it("gives the tab strip tablist roles and pushes tab changes", async () => {
		const user = userEvent.setup();
		mockPending();
		mockAxios.onGet(RUNS_URL).reply(200, runs);
		const onUrlUpdate = vi.fn();

		renderPage("?tab=pending", onUrlUpdate);

		const tablist = screen.getByRole("tablist", {
			name: "Вкладки синхронізації",
		});
		const tabs = within(tablist).getAllByRole("tab");
		expect(tabs).toHaveLength(3);
		expect(tabs[0]).toHaveAttribute("aria-selected", "true");
		expect(tabs[1]).toHaveAttribute("aria-selected", "false");

		await user.click(tabs[1]);

		expect(onUrlUpdate).toHaveBeenCalled();
		expect(onUrlUpdate.mock.calls.at(-1)?.[0].options.history).toBe("push");
	});

	it("keeps every unrated mapping question apart after a confirm", async () => {
		const user = userEvent.setup();
		mockPending();
		mockAxios.onPost(KEEP_APART_URL).reply(200, { count: 3 });

		renderPage("?tab=pending");

		await user.click(
			await screen.findByRole("button", {
				name: "Залишити окремо всі без оцінок",
			}),
		);
		const dialog = await screen.findByRole("alertdialog");
		expect(
			within(dialog).getByText("Залишити окремо всі без оцінок?"),
		).toBeInTheDocument();
		await user.click(
			within(dialog).getByRole("button", { name: "Залишити окремо" }),
		);

		await waitFor(() => expect(mockAxios.history.post).toHaveLength(1));
		expect(mockAxios.history.post[0].url).toBe(KEEP_APART_URL);
	});

	it("shows a course name instead of its raw id in a diff", async () => {
		const offering: SyncChange = {
			...courseChange,
			id: 18,
			kind: "new_offering",
			key: "ud-offering-2",
			after: {
				saz_code: "TEST05",
				course_id: "018f4b9e-0000-7000-8000-000000000001",
				display: {
					course: {
						title: "Основи тестів",
						department: "Кафедра тестів",
						years: [2030],
						saz_codes: ["TEST05"],
					},
				},
			},
		};
		mockPending({
			...pending,
			...page([offering]),
			groups: { new: 1 },
			kinds: { new_offering: 1 },
		});

		renderPage("?tab=pending");

		const catalog = await screen.findByRole("list", {
			name: "Каталог: Нові записи",
		});
		expect(
			within(catalog).getAllByText("Основи тестів").length,
		).toBeGreaterThan(0);
		expect(
			within(catalog).queryByText("018f4b9e-0000-7000-8000-000000000001"),
		).toBeNull();
	});
});

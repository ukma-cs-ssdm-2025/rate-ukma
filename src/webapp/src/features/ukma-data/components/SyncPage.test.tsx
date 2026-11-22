import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

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

function renderPage(search = "") {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	render(
		<QueryClientProvider client={queryClient}>
			<NuqsTestingAdapter searchParams={search} hasMemory>
				<SyncPage />
			</NuqsTestingAdapter>
		</QueryClientProvider>,
	);
	return { queryClient };
}

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
			screen.getByRole("list", { name: "Викладачі: Зміни" }),
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

	it("renders the pending tab while review cases are forbidden", async () => {
		mockAxios
			.onGet("/api/v1/ukma-data/review-cases/")
			.reply(403, { detail: "x", code: "ukma_data_forbidden", status: 403 });
		mockPending();

		renderPage("?tab=pending");

		expect(
			await screen.findByRole("list", { name: "Каталог: Нові записи" }),
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
});

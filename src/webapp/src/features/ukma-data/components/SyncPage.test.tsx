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
	SyncPolicy,
	SyncPolicyChangeListResponse,
	SyncPolicyListResponse,
	SyncRun,
	SyncRunListResponse,
} from "@/lib/api/generated";
import { SyncPage } from "./SyncPage";
import { appliedApproval, catalogSummary } from "./syncTestData";

const APPROVALS_URL = "/api/v1/ukma-data/sync/runs/7/approvals/";
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

const changeCalls = () =>
	mockAxios.history.get.filter((call) => call.url === RUN_CHANGES_URL);

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

const page = <T,>(items: T[]) => ({
	items,
	page: 1,
	page_size: 20,
	total: items.length,
	total_pages: 1,
	next_page: null,
	previous_page: null,
});

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

beforeEach(() => {
	mockAxios = new MockAdapter(authorizedHttpClient);
	mockAxios
		.onGet("/api/v1/ukma-data/sync/approvals/active/")
		.reply(200, { item: null });
	mockAxios.onGet(APPROVALS_URL).reply(200, page([appliedApproval]));
	mockAxios
		.onGet("/api/v1/ukma-data/sync/summary/")
		.reply(200, { ...catalogSummary, run: catalogRun });
});

afterEach(() => {
	mockAxios.restore();
});

describe("sync section", () => {
	it("opens a run from history and shows its changes", async () => {
		const user = userEvent.setup();
		mockAxios.onGet(RUNS_URL).reply(200, runs);
		mockAxios.onGet(RUN_CHANGES_URL).reply(200, runChanges);

		renderPage("?tab=history");

		const list = await screen.findByRole("list", {
			name: "Запуски синхронізації",
		});
		expect(
			within(list).getByText(/Нові записи · Чекає: 2/),
		).toBeInTheDocument();
		await user.click(within(list).getAllByRole("button")[0]);

		expect(
			await screen.findByRole("list", { name: "Зміни запуску 7" }),
		).toHaveTextContent("Застосовано");
		expect(changeCalls().at(-1)?.params).toEqual({
			page: 1,
			page_size: 20,
		});
	});

	it("filters a run's changes by state from the URL", async () => {
		mockAxios.onGet(RUN_CHANGES_URL).reply(200, runChanges);

		renderPage("?tab=history&openRun=7&changesState=applied");

		await screen.findByRole("list", { name: "Зміни запуску 7" });
		expect(changeCalls()[0].params).toEqual({
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
		expect(
			mockAxios.history.get.find((call) => call.url === RUNS_URL)?.params,
		).toMatchObject({ page: 2 });
		await user.click(within(list).getAllByRole("button")[0]);

		await screen.findByRole("list", { name: "Зміни запуску 7" });
		expect(changeCalls().at(-1)?.params).toEqual({
			page: 1,
			page_size: 20,
		});
	});

	it("shows the run's decisions, a session filter and the CSV link", async () => {
		// Arrange
		const user = userEvent.setup();
		mockAxios.onGet(RUN_CHANGES_URL).reply(200, runChanges);

		// Act
		renderPage("?tab=history&openRun=7");
		const decisions = await screen.findByRole("list", {
			name: "Рішення запуску",
		});

		// Assert
		expect(decisions).toHaveTextContent("Звʼязки з точним збігом: курси");
		expect(decisions).toHaveTextContent("reviewer@example.invalid");
		expect(decisions).toHaveTextContent(
			/застосовано 4\s828 · уже неактуальні 2/,
		);
		expect(
			screen.getByRole("link", { name: "Завантажити CSV" }),
		).toHaveAttribute(
			"href",
			expect.stringMatching(
				/\/api\/v1\/ukma-data\/sync\/runs\/7\/export\.csv$/,
			),
		);
		await user.click(screen.getByRole("checkbox", { name: "Ця сесія" }));
		expect(
			await screen.findByText(
				"Сьогодні ви нічого не застосовували в цьому запуску.",
			),
		).toBeInTheDocument();
	});

	it("labels each rule by risk and explains auto mode", async () => {
		// Arrange
		mockAxios.onGet(POLICIES_URL).reply(200, {
			items: [
				{ ...policies[0], kind: "link_offering", group: "link", mode: "auto" },
				policies[1],
			],
		});
		mockAxios.onGet(POLICY_CHANGES_URL).reply(200, policyChanges);

		// Act
		renderPage("?tab=rules");

		// Assert
		const rules = await screen.findByRole("list", { name: "Правила: Каталог" });
		expect(rules).toHaveTextContent("Без видимих змін");
		expect(rules).toHaveTextContent("Переносить оцінки");
		expect(rules).toHaveTextContent("завжди з підтвердженням");
		expect(rules).toHaveTextContent(
			"Застосовується щоночі без вас, крім змін, що зачіпають оцінки чи плани.",
		);
	});

	it("lists policies and disables the toggle for a never-auto kind", async () => {
		mockAxios
			.onGet(POLICIES_URL)
			.reply(200, { items: policies } satisfies SyncPolicyListResponse);
		mockAxios.onGet(POLICY_CHANGES_URL).reply(200, policyChanges);

		renderPage("?tab=rules");

		expect(
			screen.getByText(
				"Питання й зміни, що переносять оцінки, завжди потребують підтвердження.",
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

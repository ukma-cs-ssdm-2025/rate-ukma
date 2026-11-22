import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { authorizedHttpClient } from "@/lib/api/apiClient";
import type { SyncSummary } from "@/lib/api/generated";
import { SyncPage } from "./SyncPage";
import {
	appliedApproval,
	catalogSummary,
	emptySummary,
	listPage,
	pendingLinks,
	SYNC_URL,
} from "./syncTestData";

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
}

function mockReview(summary: SyncSummary = catalogSummary) {
	mockAxios.onGet(`${SYNC_URL}/summary/`).reply((config) => {
		const params: unknown = config.params;
		const teachers =
			typeof params === "object" &&
			params !== null &&
			"source" in params &&
			params.source === "teachers";
		return teachers ? [404, { detail: "x", status: 404 }] : [200, summary];
	});
	mockAxios.onGet(`${SYNC_URL}/approvals/active/`).reply(200, { item: null });
	mockAxios.onGet(`${SYNC_URL}/runs/7/approvals/`).reply(200, listPage([]));
	mockAxios.onGet(`${SYNC_URL}/runs/`).reply(200, listPage([]));
	mockAxios.onGet(`${SYNC_URL}/pending/`).reply(200, pendingLinks);
}

const pendingCalls = () =>
	mockAxios.history.get.filter((call) => call.url === `${SYNC_URL}/pending/`);

beforeEach(() => {
	mockAxios = new MockAdapter(authorizedHttpClient);
});

afterEach(() => {
	mockAxios.restore();
});

describe("sync review overview", () => {
	it("renders the work path in order with counts and risk labels", async () => {
		// Arrange
		mockReview();

		// Act
		renderPage();

		// Assert
		const path = await screen.findByRole("list", { name: "Порядок роботи" });
		const steps = within(path).getAllByRole("listitem");
		expect(
			steps.map((item) => within(item).getByRole("heading").textContent),
		).toEqual([
			"Крок 1. Звʼязки з точним збігом",
			"Крок 2. Питання з оцінками",
			"Крок 3. Решта питань",
			"Крок 4. Звʼязки, які варто перевірити",
			"Крок 5. Нові курси й курси в семестрі",
			"Крок 6. Зміни полів",
			"Крок 7. Зникли з САЗ",
		]);
		expect(steps[0]).toHaveTextContent(/28\s950/);
		expect(steps[0]).toHaveTextContent("Без видимих змін");
		expect(steps[1]).toHaveTextContent("Переносить оцінки");
		expect(steps[1]).toHaveTextContent("41 оцінка · 3 плани");
		expect(steps[4]).toHaveTextContent("12 схожі на курси, які вже є.");
		expect(steps[4]).toHaveTextContent("47 чекають на інші зміни.");
		expect(screen.getByRole("radio", { name: /Каталог/ })).toHaveTextContent(
			/32\s345/,
		);
		expect(
			screen.getByRole("button", { name: /Не запропоновано:/ }),
		).toHaveTextContent(/1\s234/);
	});

	it("shows saved answers and routes questions to the question entry", async () => {
		// Arrange
		const user = userEvent.setup();
		mockReview({
			...catalogSummary,
			answers: { merge: 120, keep_apart: 60, keep: 0, place: 0, move: 2 },
		});
		renderPage();

		// Act
		const answers = await screen.findByRole("region", {
			name: "Ваші відповіді",
		});
		await user.click(screen.getByRole("button", { name: "Почати розгляд" }));

		// Assert
		expect(answers).toHaveTextContent("120 обʼєднати · 60 залишити окремо");
		expect(answers).toHaveTextContent("зʼявляться у завтрашньому запуску");
		expect(await screen.findByText("Питання")).toBeInTheDocument();
	});

	it("keeps step buttons full width at phone width", async () => {
		// Arrange
		globalThis.innerWidth = 390;
		mockReview();

		// Act
		renderPage();

		// Assert
		const path = await screen.findByRole("list", { name: "Порядок роботи" });
		for (const button of within(path).getAllByRole("button")) {
			expect(button).toHaveClass("w-full", "sm:w-auto");
		}
		expect(path.closest(".min-w-0")).not.toBeNull();
	});

	it("says nothing waits when every step is empty", async () => {
		// Arrange
		mockReview(emptySummary);

		// Act
		renderPage();

		// Assert
		expect(await screen.findByText("Нічого не чекає")).toBeInTheDocument();
		expect(
			screen.getByText(
				"Наступний запуск каталогу о 02:30, викладачів о 02:00.",
			),
		).toBeInTheDocument();
	});

	it("says the sync never ran on a 404", async () => {
		// Arrange
		mockReview();

		// Act
		renderPage("?source=teachers");

		// Assert
		expect(
			await screen.findByText("Синхронізація викладачів ще не запускалась"),
		).toBeInTheDocument();
	});

	it("shows skeleton rows while loading", async () => {
		// Arrange
		mockAxios.onGet(`${SYNC_URL}/approvals/active/`).reply(200, { item: null });
		mockAxios
			.onGet(`${SYNC_URL}/summary/`)
			.reply(() => new Promise(() => undefined));

		// Act
		renderPage();

		// Assert
		expect(screen.getAllByLabelText("Завантаження").length).toBeGreaterThan(0);
	});

	it("shows the error state with a retry", async () => {
		// Arrange
		mockAxios.onGet(`${SYNC_URL}/approvals/active/`).reply(200, { item: null });
		mockAxios
			.onGet(`${SYNC_URL}/summary/`)
			.reply(500, { detail: "x", status: 500 });

		// Act
		renderPage();

		// Assert
		expect(
			await screen.findByText("Не вдалося завантажити розгляд"),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Спробувати знову" }),
		).toBeEnabled();
	});

	it("shows the staff-only state on a 403", async () => {
		// Arrange
		mockAxios
			.onGet(`${SYNC_URL}/approvals/active/`)
			.reply(403, { detail: "x", status: 403 });
		mockAxios
			.onGet(`${SYNC_URL}/summary/`)
			.reply(403, { detail: "x", status: 403 });
		mockAxios.onGet("/api/v1/auth/session/").reply(200, { user: null });

		// Act
		renderPage();

		// Assert
		expect(
			await screen.findByText("Розділ лише для суперкористувачів"),
		).toBeInTheDocument();
	});

	it("collapses a finished step to who applied it", async () => {
		// Arrange
		mockReview({
			...catalogSummary,
			steps: catalogSummary.steps.map((item) =>
				item.step === "exact_links" ? { ...item, kinds: {}, count: 0 } : item,
			),
		});
		mockAxios
			.onGet(`${SYNC_URL}/runs/7/approvals/`)
			.reply(200, listPage([appliedApproval]));

		// Act
		renderPage();

		// Assert
		const path = await screen.findByRole("list", { name: "Порядок роботи" });
		await waitFor(() =>
			expect(within(path).getAllByRole("listitem")[0]).toHaveTextContent(
				/✓ Застосовано 4\s828 — reviewer@example\.invalid/,
			),
		);
	});

	it("disables apply while another approval runs", async () => {
		// Arrange
		mockReview();
		mockAxios
			.onGet(`${SYNC_URL}/approvals/active/`)
			.reply(200, { item: { ...appliedApproval, outcome: "started" } });

		// Act
		renderPage("?group=exact_links&kind=link_course");

		// Assert
		expect(await screen.findByRole("status")).toHaveTextContent(
			"Застосовується: Звʼязки з точним збігом: курси",
		);
		expect(
			await screen.findByRole("button", { name: /Застосувати всі/ }),
		).toBeDisabled();
	});
});

describe("sync group list", () => {
	it("asks for a sample first and for all rows on request", async () => {
		// Arrange
		const user = userEvent.setup();
		mockReview();
		renderPage("?group=exact_links");
		await screen.findByText("«Основи числових методів»");

		// Act
		await user.click(screen.getByRole("radio", { name: "Усі, по 50" }));

		// Assert
		await waitFor(() => expect(pendingCalls()).toHaveLength(2));
		expect(pendingCalls()[0].params).toMatchObject({
			group: "link",
			match: "exact",
			kind: "link_offering",
			view: "sample",
			seed: 1,
		});
		expect(pendingCalls()[1].params).toMatchObject({ view: "all" });
		expect(pendingCalls()[1].params).not.toHaveProperty("seed");
	});

	it("sends the search, the rated filter and the similar facet", async () => {
		// Arrange
		const user = userEvent.setup();
		mockReview();
		renderPage("?group=new_rows&kind=new_course");
		await screen.findByText("«Основи числових методів»");

		// Act
		await user.type(
			screen.getByRole("searchbox", { name: "Пошук: назва або код САЗ" }),
			"315421{Enter}",
		);
		await user.click(screen.getByRole("checkbox", { name: "з оцінками" }));
		await user.click(
			screen.getByRole("checkbox", { name: /схожий курс уже є/ }),
		);

		// Assert
		await waitFor(() =>
			expect(pendingCalls().at(-1)?.params).toMatchObject({
				group: "new",
				kind: "new_course",
				q: "315421",
				rated: true,
				similar_existing: true,
			}),
		);
	});

	it("highlights the differing part of the UKMA Data title", async () => {
		// Arrange
		mockReview();

		// Act
		renderPage("?group=exact_links");

		// Assert
		const mark = await screen.findByText("ельн", { selector: "mark" });
		expect(mark).toBeInTheDocument();
	});

	it("names how many rows were seen on the separate bulk button", async () => {
		// Arrange
		mockReview();

		// Act
		renderPage("?group=exact_links&kind=link_course");

		// Assert
		expect(
			await screen.findByRole("button", {
				name: /Застосувати всі 4\s830 \(переглянуто 1\)…/,
			}),
		).toBeInTheDocument();
	});

	it("opens the drawer through a button and returns focus on close", async () => {
		// Arrange
		const user = userEvent.setup();
		mockReview();
		renderPage("?group=exact_links");
		const details = await screen.findByRole("button", {
			name: "Деталі: Основи числових методів",
		});

		// Act
		await user.click(details);
		const drawer = await screen.findByRole("dialog", { name: "Деталі зміни" });
		expect(drawer).toHaveTextContent("Звʼязок курсу");
		await user.click(
			within(drawer).getByRole("button", { name: "Закрити деталі" }),
		);

		// Assert
		await waitFor(() => expect(details).toHaveFocus());
	});
});

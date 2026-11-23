import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import MockAdapter from "axios-mock-adapter";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { authorizedHttpClient } from "@/lib/api/apiClient";
import {
	listPage,
	NOW,
	pending,
	PENDING_URL,
	policies,
	POLICIES_URL,
	POLICY_CHANGES_URL,
	QUESTIONS_URL,
	question,
	titleChange,
} from "./dataTestData";
import { SyncPage } from "./SyncPage";

vi.mock("@tanstack/react-router", async () => ({
	Link: (await import("@/test-utils/router")).MockLink,
}));

let mock: MockAdapter;

function renderSync(search = "") {
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

const noDecisionButtons = () =>
	expect(
		screen.queryByRole("button", {
			name: /застосувати|підтвердити|відхилити|відповісти|зберегти/i,
		}),
	).not.toBeInTheDocument();

beforeEach(() => {
	vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
	mock = new MockAdapter(authorizedHttpClient);
	mock.onGet(PENDING_URL).reply(200, pending([titleChange], 150));
	mock.onGet(QUESTIONS_URL).reply(200, { items: [question], next_after: null });
	mock.onGet(POLICIES_URL).reply(200, { items: policies });
	mock.onGet(POLICY_CHANGES_URL).reply(200, listPage([]));
});

afterEach(() => {
	mock.restore();
	vi.useRealTimers();
});

describe("/data/sync", () => {
	it("shows one row per group with its count and what it means", async () => {
		// Act
		renderSync();

		// Assert
		const list = within(
			await screen.findByRole("list", { name: "Що чекає рішення" }),
		);
		const items = list.getAllByRole("listitem");
		expect(items).toHaveLength(5);
		expect(items[0]).toHaveTextContent("Нові812На сайті з'явиться новий запис");
		expect(items[1]).toHaveTextContent(
			"Зв'язати301Запис отримає id з САЗ, на сайті нічого не видно",
		);
		expect(items[3]).toHaveTextContent(
			"Питання18Відповісти: catalog_sync answer (у консолі)",
		);
		expect(items[4]).toHaveTextContent(
			"Зникли з САЗ3Нічого не записується, лише для відома",
		);
		noDecisionButtons();
	});

	it("links every group to its preview", async () => {
		// Act
		renderSync();

		// Assert
		const list = within(
			await screen.findByRole("list", { name: "Що чекає рішення" }),
		);
		for (const row of list.getAllByRole("listitem")) {
			expect(
				within(row).getByRole("link", { name: "Переглянути" }),
			).toHaveAttribute("href", "/data/sync/preview");
		}
	});

	it("says when nothing waits", async () => {
		// Arrange
		mock.onGet(PENDING_URL).reply(200, {
			...pending([], 0),
			groups: { new: 0, link: 0, change: 0, mapping: 0, removed: 0 },
		});

		// Act
		renderSync();

		// Assert
		expect(
			await screen.findByText("Нічого не чекає рішення"),
		).toBeInTheDocument();
		expect(
			screen.getByText("Наступне читання САЗ о 02:30."),
		).toBeInTheDocument();
	});

	it("lists the rules read-only, marking kinds that are never automatic", async () => {
		// Act
		renderSync("?tab=rules");

		// Assert
		const list = within(
			await screen.findByRole("list", { name: "Правила за типом змін" }),
		);
		const [newCourse, changeCourse, merge] = list.getAllByRole("listitem");
		expect(newCourse).toHaveTextContent("Потребує рішення");
		expect(changeCourse).toHaveTextContent("Авто");
		expect(merge).toHaveTextContent("Лише вручну");
		expect(screen.queryByRole("switch")).not.toBeInTheDocument();
		noDecisionButtons();
	});
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import MockAdapter from "axios-mock-adapter";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { authorizedHttpClient } from "@/lib/api/apiClient";
import {
	emptySummary,
	listPage,
	NOW,
	policies,
	POLICIES_URL,
	POLICY_CHANGES_URL,
	QUESTIONS_URL,
	question,
	summary,
	SUMMARY_URL,
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
	mock.onGet(SUMMARY_URL).reply(200, summary);
	mock.onGet(QUESTIONS_URL).reply(200, { items: [question], next_after: null });
	mock.onGet(POLICIES_URL).reply(200, { items: policies });
	mock.onGet(POLICY_CHANGES_URL).reply(200, listPage([]));
});

afterEach(() => {
	mock.restore();
	vi.useRealTimers();
});

describe("/data/sync", () => {
	it("shows one step per kind of decision, in apply order", async () => {
		// Act
		renderSync();

		// Assert
		const list = within(
			await screen.findByRole("list", { name: "Що чекає рішення" }),
		);
		const items = list.getAllByRole("listitem");
		expect(items.map((item) => item.querySelector("h3")?.textContent)).toEqual([
			"Звʼязки без змін на сайті",
			"Нові записи",
			"Зміни на сторінках без оцінок",
			"Зміни на сторінках з оцінками",
			"Питання",
			"Зникли з САЗ",
		]);
		expect(items[3]).toHaveTextContent("4");
		noDecisionButtons();
	});

	it("links every step to its review", async () => {
		// Act
		renderSync();

		// Assert
		const list = within(
			await screen.findByRole("list", { name: "Що чекає рішення" }),
		);
		const link = within(list.getAllByRole("listitem")[0]).getByRole("link");
		expect(link).toHaveAttribute("href", "/data/sync/preview");
		expect(JSON.parse(link.getAttribute("data-search") ?? "{}")).toEqual({
			step: "links",
		});
	});

	it("says when nothing waits", async () => {
		// Arrange
		mock.onGet(SUMMARY_URL).reply(200, emptySummary);

		// Act
		renderSync();

		// Assert
		expect(
			await screen.findByText("Нічого не чекає рішення"),
		).toBeInTheDocument();
	});

	it("says nothing waits before the first read", async () => {
		// Arrange
		mock
			.onGet(SUMMARY_URL)
			.reply(404, { detail: "Синхронізацію ще не запускали" });

		// Act
		renderSync();

		// Assert
		expect(
			await screen.findByText("Нічого не чекає рішення"),
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

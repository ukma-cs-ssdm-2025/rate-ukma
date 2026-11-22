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
	question,
	QUESTIONS_URL,
	titleChange,
} from "./dataTestData";
import { SyncPage } from "./SyncPage";

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
	it("lists a group's waiting changes with their number and old → new", async () => {
		// Act
		renderSync("?group=change");

		// Assert
		const list = within(
			await screen.findByRole("list", { name: "Зміни, що чекають рішення" }),
		);
		const [card] = list.getAllByRole("listitem");
		expect(card).toHaveTextContent("#48121");
		expect(card).toHaveTextContent(
			"Тестова дисципліна А → Тестова дисципліна Б",
		);
		expect(card).toHaveTextContent("12 оцінок");
		expect(mock.history.get.at(-1)?.params).toMatchObject({ group: "change" });
		noDecisionButtons();
	});

	it("explains each group in one plain line", async () => {
		// Act
		renderSync("?group=link");

		// Assert
		expect(
			await screen.findByText(
				/Застосування лише запам'ятовує, що це той самий запис/,
			),
		).toBeInTheDocument();
	});

	it("shows a mapping question's courses read-only", async () => {
		// Act
		renderSync("?group=mapping");

		// Assert
		const list = within(await screen.findByRole("list", { name: "Питання" }));
		expect(list.getByText("#50011")).toBeInTheDocument();
		expect(list.getAllByText(/На сайті: «Тестова дисципліна В»/)).toHaveLength(
			2,
		);
		expect(list.getByText("Відповіді ще немає.")).toBeInTheDocument();
		noDecisionButtons();
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

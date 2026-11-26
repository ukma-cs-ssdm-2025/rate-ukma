import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import MockAdapter from "axios-mock-adapter";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { authorizedHttpClient } from "@/lib/api/apiClient";
import {
	listPage,
	NOW,
	policies,
	POLICIES_URL,
	POLICY_CHANGES_URL,
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
	mock.onGet(POLICIES_URL).reply(200, { items: policies });
	mock.onGet(POLICY_CHANGES_URL).reply(200, listPage([]));
});

afterEach(() => {
	mock.restore();
	vi.useRealTimers();
});

describe("/data/sync", () => {
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

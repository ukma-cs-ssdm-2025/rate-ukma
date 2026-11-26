import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
	it("lists the rules with a switch for each kind that can be automatic", async () => {
		// Act
		renderSync("?tab=rules");

		// Assert
		const list = within(
			await screen.findByRole("list", { name: "Правила за типом змін" }),
		);
		const [newCourse, changeCourse, merge] = list.getAllByRole("listitem");
		expect(within(newCourse!).getByRole("switch")).toHaveAttribute(
			"aria-checked",
			"false",
		);
		expect(within(changeCourse!).getByRole("switch")).toHaveAttribute(
			"aria-checked",
			"true",
		);
		expect(within(merge!).queryByRole("switch")).toBeNull();
		expect(merge).toHaveTextContent("Лише вручну");
		noDecisionButtons();
	});

	it("asks before turning a rule to auto and saves it", async () => {
		// Arrange
		vi.useRealTimers();
		const user = userEvent.setup();
		mock
			.onPost(`${POLICIES_URL}new_course/`)
			.reply(200, { ...policies[0], mode: "auto" });
		renderSync("?tab=rules");

		// Act
		const list = within(
			await screen.findByRole("list", { name: "Правила за типом змін" }),
		);
		await user.click(list.getAllByRole("switch")[0]!);
		const dialog = within(await screen.findByRole("alertdialog"));
		await user.click(dialog.getByRole("button", { name: "Увімкнути авто" }));

		// Assert
		await waitFor(() => expect(mock.history.post).toHaveLength(1));
		expect(JSON.parse(mock.history.post[0]?.data as string)).toEqual({
			mode: "auto",
		});
	});
});

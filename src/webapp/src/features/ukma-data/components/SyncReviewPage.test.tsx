import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { authorizedHttpClient } from "@/lib/api/apiClient";
import { pending, PENDING_URL, SYNC_URL, titleChange } from "./dataTestData";
import { decisionCounts, previewFixture } from "./syncActionsTestData";
import { SyncReviewPage } from "./SyncReviewPage";

vi.mock("@tanstack/react-router", async () => ({
	Link: (await import("@/test-utils/router")).MockLink,
}));

const PREVIEW_URL = `${SYNC_URL}/preview/`;
const APPLY_URL = `${SYNC_URL}/apply/`;

const second = {
	...titleChange,
	id: 48_122,
	view: { ...titleChange.view, title: "Тестова дисципліна В" },
};

let mock: MockAdapter;

function renderReview(search: string) {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	render(
		<QueryClientProvider client={queryClient}>
			<NuqsTestingAdapter searchParams={search} hasMemory>
				<SyncReviewPage />
			</NuqsTestingAdapter>
		</QueryClientProvider>,
	);
}

beforeEach(() => {
	mock = new MockAdapter(authorizedHttpClient);
	mock.onGet(PENDING_URL).reply(200, {
		...pending([titleChange, second], 2),
		changed_fields: { title: 2, credits: 1 },
	});
});

afterEach(() => {
	mock.restore();
});

describe("/data/sync/preview", () => {
	it("lists rated changes in words without ids or payloads", async () => {
		// Act
		renderReview("?step=changes_rated");

		// Assert
		const list = within(
			await screen.findByRole("list", {
				name: "Зміни на сторінках з оцінками",
			}),
		);
		const [row] = list.getAllByRole("listitem");
		expect(row).toHaveTextContent("Тестова дисципліна А");
		expect(row).toHaveTextContent("Кафедра прикладів");
		expect(row).toHaveTextContent("Назва: Тестова дисципліна А");
		expect(row).not.toHaveTextContent("48121");
		expect(mock.history.get[0]?.params).toMatchObject({
			group: "change",
			rated: true,
		});
		expect(screen.getByRole("radio", { name: /Кредити/ })).toBeInTheDocument();
	});

	it("previews and applies the selection without the rows left out", async () => {
		// Arrange
		const user = userEvent.setup();
		mock.onPost(PREVIEW_URL).reply(
			200,
			previewFixture({
				counts: decisionCounts({ applied: 1, total: 1 }),
			}),
		);
		mock.onPost(APPLY_URL).reply(200, {
			decision_id: 75,
			action: "apply",
			outcome: "applied",
			detail: "Застосовано 1 зміну. Рішення #75.",
			counts: decisionCounts({ applied: 1, total: 1 }),
			run: previewFixture().run,
		});
		renderReview("?step=changes_rated");
		await user.click(
			await screen.findByRole("checkbox", { name: "Тестова дисципліна В" }),
		);

		// Act
		expect(screen.getByText(/1 з 2/)).toHaveTextContent("Вибрано 1 з 2");
		await user.click(screen.getByRole("button", { name: "Застосувати" }));
		await user.click(
			await screen.findByRole("button", { name: "Застосувати 1" }),
		);

		// Assert
		expect(
			await screen.findByText("Застосовано 1 зміну. Рішення #75."),
		).toBeInTheDocument();
		const previewBody = JSON.parse(String(mock.history.post[0]?.data));
		expect(previewBody).toMatchObject({
			run: 7,
			group: "change",
			rated: true,
			exclude_ids: [48_122],
		});
		const applyBody = JSON.parse(String(mock.history.post[1]?.data));
		expect(applyBody).toMatchObject({
			run: 7,
			token: "token-test",
			exclude_ids: [48_122],
		});
	});

	it("explains what waits for earlier steps before applying", async () => {
		// Arrange
		const user = userEvent.setup();
		mock.onPost(PREVIEW_URL).reply(
			200,
			previewFixture({
				counts: decisionCounts({ applied: 1, waiting: 1, total: 2 }),
				waiting_reasons: [
					{ code: "waiting_on", text: "чекає на інші зміни", count: 1 },
				],
			}),
		);
		renderReview("?step=new");

		// Act
		await user.click(
			await screen.findByRole("button", { name: "Застосувати" }),
		);

		// Assert
		expect(
			await screen.findByText("Застосується 1 зміну."),
		).toBeInTheDocument();
		expect(
			screen.getByText(/1 чекають на інші зміни, яких ще немає на сайті/),
		).toBeInTheDocument();
	});

	it("offers no decisions on removed rows", async () => {
		// Act
		renderReview("?step=removed");

		// Assert
		await screen.findByRole("list", { name: "Зникли з САЗ" });
		expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Застосувати" }),
		).not.toBeInTheDocument();
	});
});

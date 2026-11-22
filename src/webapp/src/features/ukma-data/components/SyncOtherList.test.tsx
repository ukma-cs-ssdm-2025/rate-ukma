import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type MockAdapter from "axios-mock-adapter";
import { afterEach, describe, expect, it } from "vitest";

import type { SyncChange, SyncPendingResponse } from "@/lib/api/generated";
import {
	catalogRun,
	catalogSummary,
	doneGroups,
	emptySummary,
	linkChange,
	linksPreview,
	listPage,
} from "./syncTestData";
import {
	APPROVE_URL,
	bodyOf,
	mockSync,
	PENDING_URL,
	PREVIEW_URL,
	REJECT_URL,
	renderSync,
} from "./syncTestRender";

let mock: MockAdapter;

afterEach(() => {
	mock.restore();
});

const otherSummary = {
	...emptySummary,
	groups: { ...doneGroups, other: { total: 2 } },
};

const relink: SyncChange = {
	...linkChange,
	id: 801,
	group: "mapping",
	kind: "relink_course",
	after: {
		display: {
			course: { title: "Основи мережевих протоколів", department: "" },
		},
	},
};

const pending = (items: SyncChange[], total: number): SyncPendingResponse => ({
	...listPage(items, total),
	page_size: 12,
	total_pages: 1,
	groups: {},
	kinds: {},
	runs: [catalogRun],
});

const applied = {
	id: 40,
	action: "apply",
	outcome: "applied",
	counts: { applied: 2 },
	error: "",
};

describe("other changes", () => {
	it("keeps them pending instead of saying everything is decided", async () => {
		// Arrange
		mock = mockSync(otherSummary);

		// Act
		renderSync();

		// Assert
		expect(await screen.findByText("Інші зміни: 2")).toBeInTheDocument();
		expect(screen.getByText("Зміниться на сайті")).toBeInTheDocument();
		expect(screen.queryByText("Усе вирішено")).not.toBeInTheDocument();
	});

	it("lists them in words for the summary's run and approves the previewed list", async () => {
		// Arrange
		const user = userEvent.setup();
		mock = mockSync(otherSummary);
		mock.onGet(PENDING_URL).reply(200, pending([relink], 2));
		mock.onPost(PREVIEW_URL).reply(200, { ...linksPreview, count: 2 });
		mock.onPost(APPROVE_URL).reply(200, applied);
		renderSync("?view=other");

		// Act
		expect(
			await screen.findByText(/прив'яжеться до іншого запису САЗ/),
		).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "Застосувати всі 2" }));
		const dialog = await screen.findByRole("dialog");
		await user.click(
			await within(dialog).findByRole("button", { name: "Застосувати 2" }),
		);

		// Assert
		await waitFor(() => expect(bodyOf(mock, APPROVE_URL)).toHaveLength(1));
		expect(
			mock.history.get.find((call) => call.url === PENDING_URL)?.params,
		).toMatchObject({ run: catalogRun.id, group: "other" });
		expect(bodyOf(mock, APPROVE_URL)[0]).toMatchObject({
			token: linksPreview.token,
			selection: { filter: { group: "other" } },
		});
	});

	it("skips the whole list by rejecting it", async () => {
		// Arrange
		const user = userEvent.setup();
		mock = mockSync(otherSummary);
		mock.onGet(PENDING_URL).reply(200, pending([relink], 2));
		mock.onPost(PREVIEW_URL).reply(200, { ...linksPreview, count: 2 });
		mock.onPost(REJECT_URL).reply(200, {
			...applied,
			action: "reject",
			counts: { rejected: 2 },
		});
		renderSync("?view=other");

		// Act
		await user.click(await screen.findByRole("button", { name: "Пропустити" }));
		const dialog = await screen.findByRole("dialog");
		await user.click(
			await within(dialog).findByRole("button", { name: "Пропустити 2" }),
		);

		// Assert
		await waitFor(() => expect(bodyOf(mock, REJECT_URL)).toHaveLength(1));
		expect(bodyOf(mock, APPROVE_URL)).toHaveLength(0);
		expect(bodyOf(mock, REJECT_URL)[0]).toMatchObject({
			selection: { filter: { group: "other" } },
		});
	});
});

describe("pinned run", () => {
	it("asks the pending list for the run the confirmation uses", async () => {
		// Arrange
		mock = mockSync(catalogSummary);
		mock.onGet(PENDING_URL).reply(200, pending([linkChange], 1));

		// Act
		renderSync("?view=links");

		// Assert
		await waitFor(() =>
			expect(
				mock.history.get.find((call) => call.url === PENDING_URL)?.params,
			).toMatchObject({ run: catalogSummary.run.id, group: "link" }),
		);
	});
});

describe("field row dialog", () => {
	it("lists the other fields a change with two fields updates too", async () => {
		// Arrange
		const user = userEvent.setup();
		mock = mockSync(catalogSummary);
		mock.onPost(PREVIEW_URL).reply(200, {
			...linksPreview,
			count: 1045,
			field_counts: { practice_type: 1045, practice_count: 412 },
		});
		renderSync("?view=fields");

		// Act
		await user.click(
			await screen.findByRole("button", { name: /^Підтвердити 1\s045$/ }),
		);
		const dialog = await screen.findByRole("dialog");

		// Assert
		expect(
			await within(dialog).findByText(
				"Також оновиться: кількість практичних — 412",
			),
		).toBeInTheDocument();
		expect(dialog).toHaveTextContent(
			/Семестри, де змінилось поле «тип практичних занять»/,
		);
		expect(
			screen.getByText(/Кожен рядок — це семестри, де змінилось це поле/),
		).toBeInTheDocument();
	});
});

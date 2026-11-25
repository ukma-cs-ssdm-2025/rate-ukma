import { StrictMode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { authorizedHttpClient } from "@/lib/api/apiClient";
import {
	NOW,
	PENDING_URL,
	pending,
	titleChange,
	POLICIES_URL,
	POLICY_CHANGES_URL,
} from "./dataTestData";
import {
	JOURNAL_URL,
	journalAnswer,
	journalApply,
	journalAuto,
	journalApplyReverted,
	journalPolicy,
	journalRejected,
	journalRevert,
	REVERT_URL,
	revertBlocked,
	revertDone,
	revertDryRun,
	revertRefused,
} from "./syncActionsTestData";
import { SyncPage } from "./SyncPage";

vi.mock("@tanstack/react-router", async () => ({
	Link: (await import("@/test-utils/router")).MockLink,
}));

let mock: MockAdapter;

function renderJournal(search = "?tab=history") {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	render(
		<StrictMode>
			<QueryClientProvider client={queryClient}>
				<NuqsTestingAdapter searchParams={search} hasMemory>
					<SyncPage />
				</NuqsTestingAdapter>
			</QueryClientProvider>
		</StrictMode>,
	);
}

async function openRevert() {
	const user = userEvent.setup();
	renderJournal();
	await screen.findByRole("list", { name: "Журнал" });
	await user.click(
		await screen.findByRole("button", { name: "Відкотити рішення #74" }),
	);
	return { user, dialog: await screen.findByRole("dialog") };
}

const revertRequests = () =>
	mock.history.post
		.filter((request) => request.url === REVERT_URL)
		.map((request) => JSON.parse(String(request.data)));

beforeEach(() => {
	vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
	mock = new MockAdapter(authorizedHttpClient);
	mock.onGet(PENDING_URL).reply(200, pending([]));
	mock.onGet(POLICIES_URL).reply(200, { items: [] });
	mock.onGet(POLICY_CHANGES_URL).reply(200, { items: [] });
	mock.onGet(JOURNAL_URL).reply(200, {
		items: [
			journalRevert,
			journalRejected,
			journalApply,
			journalPolicy,
			journalAnswer,
			journalAuto,
		],
		next_before: null,
	});
});

afterEach(() => {
	mock.restore();
	vi.useRealTimers();
});

describe("/data/sync journal", () => {
	it("shows which records a decision touched", async () => {
		// Arrange
		const user = userEvent.setup();
		mock
			.onGet("/api/v1/ukma-data/sync/runs/7/changes/")
			.reply(200, pending([titleChange], 1));
		renderJournal();
		const list = within(await screen.findByRole("list", { name: "Журнал" }));

		// Act
		await user.click(list.getAllByRole("button", { name: "Що саме" })[1]);

		// Assert
		const records = await screen.findByRole("list", { name: "Записи рішення" });
		expect(records).toHaveTextContent("Тестова дисципліна А");
		expect(mock.history.get.at(-1)?.params).toMatchObject({
			approval: journalApply.approval_id,
		});
	});

	it("lists every decision newest first with who and when", async () => {
		// Act
		renderJournal();

		// Assert
		const list = within(await screen.findByRole("list", { name: "Журнал" }));
		const items = list.getAllByRole("listitem");
		expect(items[0]).toHaveTextContent("рішення #76");
		expect(items[0]).toHaveTextContent(
			"Відкочено рішення #74: 1 855 записів повернуто",
		);
		expect(items[0]).toHaveTextContent("admin.test, 1 год тому");
		expect(items[1]).toHaveTextContent("Відкладено нові записи: 3 записи");
		expect(items[2]).toHaveTextContent("Оновлено на сайті: 1 855 записів");
		expect(items[2]).toHaveTextContent("admin.test, 2 год тому");
		expect(items[3]).toHaveTextContent("Правило: Звʼязок курсу → Авто");
		expect(items[4]).toHaveTextContent("Відповідь: Обʼєднання курсів");
		expect(items[5]).toHaveTextContent("Звʼязано з САЗ: 27 925 записів");
		expect(items[5]).toHaveTextContent("(автоматично)");
	});

	it("offers a revert only where it can run", async () => {
		// Act
		renderJournal();

		// Assert
		const list = within(await screen.findByRole("list", { name: "Журнал" }));
		expect(
			list.getAllByRole("button", { name: /^Відкотити рішення #/ }),
		).toHaveLength(1);
		expect(
			list.getByRole("button", { name: "Відкотити рішення #74" }),
		).toBeInTheDocument();
		expect(
			screen.getByText(
				"Цей тип застосовується автоматично. Спершу переведіть його в «Потребує рішення» (catalog_sync policy).",
			),
		).toBeInTheDocument();
	});

	it("says when there has been no decision yet", async () => {
		// Arrange
		mock.onGet(JOURNAL_URL).reply(200, { items: [], next_before: null });

		// Act
		renderJournal();

		// Assert
		expect(
			await screen.findByText("Ще не було жодного рішення."),
		).toBeInTheDocument();
	});

	it("loads the next entries through next_before", async () => {
		// Arrange
		const user = userEvent.setup();
		let calls = 0;
		mock.onGet(JOURNAL_URL).reply(() => {
			calls += 1;
			return calls === 1
				? [200, { items: [journalApply], next_before: "2030-09-10T09:00:00Z" }]
				: [200, { items: [journalRevert], next_before: null }];
		});

		// Act
		renderJournal();
		await user.click(await screen.findByRole("button", { name: "Ще 20" }));

		// Assert
		expect(
			await screen.findByText(/Відкочено рішення #74/),
		).toBeInTheDocument();
		expect(mock.history.get.at(-1)?.params).toMatchObject({
			limit: 20,
			before: "2030-09-10T09:00:00Z",
		});
	});

	it("keeps the revert result after the journal reloads", async () => {
		// Arrange
		let calls = 0;
		mock.onGet(JOURNAL_URL).reply(() => {
			calls += 1;
			return [
				200,
				{
					items: [
						journalRevert,
						journalRejected,
						calls === 1 ? journalApply : journalApplyReverted,
						journalPolicy,
						journalAnswer,
						journalAuto,
					],
					next_before: null,
				},
			];
		});
		mock.onPost(REVERT_URL).reply((config) => {
			const body = JSON.parse(String(config.data));
			return body.dry_run === true ? [200, revertDryRun] : [200, revertDone];
		});

		// Act
		const { user, dialog } = await openRevert();

		// Assert
		expect(dialog).toHaveTextContent("Відкотити рішення #74?");
		expect(dialog).toHaveTextContent("Оновлено на сайті: 1 855 записів");
		expect(
			await screen.findByText(
				"Повернеться 1 855: поля отримають попередні значення. Нічого не видаляється.",
			),
		).toBeInTheDocument();
		await user.click(
			within(dialog).getByRole("button", { name: "Відкотити рішення #74" }),
		);
		expect(
			await screen.findByText(/Відкочено\. Рішення #76\./),
		).toBeInTheDocument();
		await waitFor(() => expect(calls).toBeGreaterThan(1));
		expect(screen.getByRole("dialog")).toBeInTheDocument();
		expect(screen.getByText(/Відкочено\. Рішення #76\./)).toBeInTheDocument();
		await user.click(within(dialog).getByRole("button", { name: "Закрити" }));
		const list = within(screen.getByRole("list", { name: "Журнал" }));
		expect(list.getByText(", відкочено")).toBeInTheDocument();
		expect(
			list.queryByRole("button", { name: "Відкотити рішення #74" }),
		).not.toBeInTheDocument();
		const [dry, write] = revertRequests();
		expect(dry).toEqual({ approval_id: 74, dry_run: true });
		expect(write).toEqual({ approval_id: 74, dry_run: false });
	});

	it("lists every blocker and does not offer to revert", async () => {
		// Arrange
		mock.onPost(REVERT_URL).reply(200, revertBlocked);

		// Act
		const { dialog } = await openRevert();

		// Assert
		expect(dialog).toHaveTextContent(
			"Не можна відкотити рішення #74: 2 зміни заважають.",
		);
		expect(dialog).toHaveTextContent("зміна #48121");
		expect(dialog).toHaveTextContent(
			"запис змінився після застосування (назва)",
		);
		expect(dialog).toHaveTextContent("зміна #48130");
		expect(dialog).toHaveTextContent(
			"спершу відкотіть рішення #77 (пізніше застосоване)",
		);
		expect(
			within(dialog).queryByRole("button", {
				name: "Відкотити рішення #74",
			}),
		).not.toBeInTheDocument();
		expect(
			within(dialog).getByRole("button", { name: "Закрити" }),
		).toBeInTheDocument();
	});

	it("lists two blockers of one change separately", async () => {
		// Arrange
		const errors = vi.spyOn(console, "error").mockImplementation(() => {});
		const [first] = revertBlocked.blockers;
		mock.onPost(REVERT_URL).reply(200, {
			...revertBlocked,
			blockers: [
				first,
				{ ...first, reason: "auto", text: "цей вид змін застосовується сам" },
			],
		});

		// Act
		const { dialog } = await openRevert();

		// Assert
		const blockers = within(
			await within(dialog).findByRole("list", { name: "Перешкоди" }),
		);
		expect(blockers.getAllByRole("listitem")).toHaveLength(2);
		expect(
			errors.mock.calls.some((call) => String(call[0]).includes("same key")),
		).toBe(false);
		errors.mockRestore();
	});

	it("shows a refused write without an empty blocker list", async () => {
		// Arrange
		mock.onPost(REVERT_URL).reply((config) => {
			const body = JSON.parse(String(config.data));
			return body.dry_run === true
				? [200, revertDryRun]
				: [409, { ...revertRefused, dry_run: false }];
		});

		// Act
		const { user, dialog } = await openRevert();
		await user.click(
			await within(dialog).findByRole("button", {
				name: "Відкотити рішення #74",
			}),
		);

		// Assert
		expect(
			await within(dialog).findByText(revertRefused.detail),
		).toBeInTheDocument();
		expect(
			within(dialog).queryByRole("list", { name: "Перешкоди" }),
		).not.toBeInTheDocument();
	});

	it("shows a refused dry run with only Закрити", async () => {
		// Arrange
		mock.onPost(REVERT_URL).reply(200, revertRefused);

		// Act
		const { dialog } = await openRevert();

		// Assert
		expect(dialog).toHaveTextContent(
			"Зараз іде нічне читання САЗ. Спробуйте за кілька хвилин.",
		);
		expect(dialog).not.toHaveTextContent(/Повернеться/);
		expect(
			within(dialog).queryByRole("button", {
				name: "Відкотити рішення #74",
			}),
		).not.toBeInTheDocument();
		expect(
			within(dialog).getByRole("button", { name: "Закрити" }),
		).toBeInTheDocument();
	});

	it("shows the blockers of a refused real revert", async () => {
		// Arrange
		mock.onPost(REVERT_URL).reply((config) => {
			const body = JSON.parse(String(config.data));
			return body.dry_run === true
				? [200, revertDryRun]
				: [409, { ...revertBlocked, dry_run: false }];
		});

		// Act
		const { user, dialog } = await openRevert();
		await user.click(
			await within(dialog).findByRole("button", {
				name: "Відкотити рішення #74",
			}),
		);

		// Assert
		expect(await within(dialog).findByText("зміна #48121")).toBeInTheDocument();
		expect(dialog).toHaveTextContent(
			"спершу відкотіть рішення #77 (пізніше застосоване)",
		);
		expect(dialog).not.toHaveTextContent(/Відкочено\. Рішення/);
	});

	it("keeps the dialog open while the revert is written", async () => {
		// Arrange
		const user = userEvent.setup();
		let release = () => {};
		mock.onPost(REVERT_URL).reply((config) => {
			const body = JSON.parse(String(config.data));
			if (body.dry_run === true) {
				return [200, revertDryRun];
			}
			return new Promise((resolve) => {
				release = () => resolve([200, revertDone]);
			});
		});
		const { dialog } = await openRevert();

		// Act
		await user.click(
			within(dialog).getByRole("button", { name: "Відкотити рішення #74" }),
		);
		expect(await screen.findByText("Відкочую…")).toBeInTheDocument();
		await user.keyboard("{Escape}");

		// Assert
		expect(screen.getByRole("dialog")).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "Close" }));
		expect(screen.getByRole("dialog")).toBeInTheDocument();
		release();
		expect(
			await screen.findByText(/Відкочено\. Рішення #76\./),
		).toBeInTheDocument();
	});
});

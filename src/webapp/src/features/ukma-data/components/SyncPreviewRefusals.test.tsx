import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { authorizedHttpClient } from "@/lib/api/apiClient";
import {
	NOW,
	PENDING_URL,
	pending,
	QUESTIONS_URL,
	question,
} from "./dataTestData";
import {
	APPLY_URL,
	changesFrom,
	PREVIEW_URL,
	previewFixture,
} from "./syncActionsTestData";
import { SyncPreviewPage } from "./SyncPreviewPage";

vi.mock("@tanstack/react-router", async () => ({
	Link: (await import("@/test-utils/router")).MockLink,
}));

let mock: MockAdapter;

function renderPreview() {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	render(
		<QueryClientProvider client={queryClient}>
			<NuqsTestingAdapter searchParams="?group=link" hasMemory>
				<SyncPreviewPage />
			</NuqsTestingAdapter>
		</QueryClientProvider>,
	);
}

async function applyAndReadAlert() {
	const user = userEvent.setup();
	renderPreview();
	await user.click(await screen.findByRole("button", { name: /^Застосувати/ }));
	return screen.findByRole("alert");
}

beforeEach(() => {
	vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
	mock = new MockAdapter(authorizedHttpClient);
	mock.onGet(PENDING_URL).reply(200, pending(changesFrom(20), 1532));
	mock.onPost(PREVIEW_URL).reply(200, previewFixture());
	mock.onGet(QUESTIONS_URL).reply(200, { items: [question], next_after: null });
});

afterEach(() => {
	mock.restore();
	vi.useRealTimers();
});

const refusals: [string, number, string, string | null][] = [
	[
		"selection_changed",
		409,
		"Список змінився. Перегляньте ще раз.",
		"Переглянути ще раз",
	],
	[
		"lock_held",
		409,
		"Зараз іде нічне читання САЗ. Спробуйте за кілька хвилин.",
		null,
	],
	[
		"run_not_current",
		409,
		"Ці зміни з попереднього читання САЗ. Відкрийте «Чекають рішення» ще раз.",
		null,
	],
	[
		"run_too_old",
		409,
		"Дані САЗ старші за 48 годин. Перегляньте ще раз після наступного читання.",
		null,
	],
	[
		"in_progress",
		409,
		"Рішення ще виконується. Перевірте Журнал, перш ніж повторювати.",
		null,
	],
	[
		"deadline_exceeded",
		422,
		"Не встигли за 40 с, нічого не записано. Виберіть менше змін.",
		null,
	],
	[
		"no_proposed_changes",
		422,
		"Серед вибраних немає змін, що чекають рішення.",
		null,
	],
	["failed", 500, "Не вдалося виконати дію. Перевірте Журнал.", null],
];

describe("/data/sync/preview refusals", () => {
	it.each(refusals)(
		"explains the %s refusal with the plan's words",
		async (code, status, text, action) => {
			// Arrange
			mock.onPost(APPLY_URL).reply(status, {
				code,
				detail: "server text",
				status,
				decision_id: null,
			});

			// Act
			const alert = await applyAndReadAlert();

			// Assert
			expect(alert).toHaveTextContent(text);
			expect(alert).toHaveFocus();
			expect(screen.getByText("✗")).toHaveAttribute("aria-hidden", "true");
			if (action !== null) {
				expect(
					screen.getByRole("button", { name: action }),
				).toBeInTheDocument();
			}
			if (code === "failed" || code === "in_progress") {
				expect(
					screen.getByRole("link", { name: "Журнал" }),
				).toBeInTheDocument();
			}
		},
	);

	it("treats a 504 as a lost answer and links the journal", async () => {
		// Arrange
		mock.onPost(APPLY_URL).reply(504, { detail: "gateway", status: 504 });

		// Act
		const alert = await applyAndReadAlert();

		// Assert
		expect(alert).toHaveTextContent(
			"Відповідь не прийшла. Перевірте Журнал, перш ніж повторювати.",
		);
		expect(screen.getByRole("link", { name: "Журнал" })).toHaveAttribute(
			"href",
			"/data/sync",
		);
	});

	it("treats a dropped connection as a lost answer", async () => {
		// Arrange
		mock.onPost(APPLY_URL).networkError();

		// Act
		const alert = await applyAndReadAlert();

		// Assert
		expect(alert).toHaveTextContent(
			"Відповідь не прийшла. Перевірте Журнал, перш ніж повторювати.",
		);
	});

	it("treats a timeout as a lost answer", async () => {
		// Arrange
		mock.onPost(APPLY_URL).timeout();

		// Act
		const alert = await applyAndReadAlert();

		// Assert
		expect(alert).toHaveTextContent(
			"Відповідь не прийшла. Перевірте Журнал, перш ніж повторювати.",
		);
	});
});

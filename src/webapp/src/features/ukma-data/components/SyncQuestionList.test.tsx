import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { authorizedHttpClient } from "@/lib/api/apiClient";
import { question, QUESTIONS_URL, summary, SUMMARY_URL } from "./dataTestData";
import { SyncQuestionList } from "./SyncQuestionList";

const ANSWER_URL = `${QUESTIONS_URL}${question.id}/answer/`;

let mock: MockAdapter;

function renderQuestions() {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	render(
		<QueryClientProvider client={queryClient}>
			<SyncQuestionList />
		</QueryClientProvider>,
	);
}

beforeEach(() => {
	mock = new MockAdapter(authorizedHttpClient);
	mock.onGet(SUMMARY_URL).reply(200, summary);
	mock.onGet(QUESTIONS_URL).reply(200, { items: [question], next_after: null });
});

afterEach(() => {
	mock.restore();
});

describe("mapping questions", () => {
	it("checks an answer first and writes it only after a confirm", async () => {
		// Arrange
		const user = userEvent.setup();
		mock.onPost(ANSWER_URL).reply((config) => {
			const body: unknown = JSON.parse(String(config.data));
			const dryRun =
				typeof body === "object" && body !== null && "dry_run" in body
					? body.dry_run
					: null;
			return [
				200,
				{
					change_id: question.id,
					answer: "merge",
					into: "course-test-2",
					ratings: 0,
					settles: false,
					dry_run: dryRun,
					detail: "Відповідь запишеться.",
				},
			];
		});
		renderQuestions();
		const [keep] = await screen.findAllByRole("button", { name: "Лишити цю" });

		// Act
		await user.click(keep ?? document.body);
		const dialog = await screen.findByRole("alertdialog");
		expect(dialog).toHaveTextContent("Обʼєднати в «Тестова дисципліна В»?");
		expect(dialog).toHaveTextContent("Оцінок це не зачіпає.");
		await user.click(
			within(dialog).getByRole("button", { name: "Записати відповідь" }),
		);

		// Assert
		await screen.findByRole("list", { name: "Питання" });
		const bodies = mock.history.post.map((request) =>
			JSON.parse(String(request.data)),
		);
		expect(bodies).toEqual([
			{ answer: "merge", into: "course-test-2", dry_run: true },
			{ answer: "merge", into: "course-test-2", dry_run: false },
		]);
	});

	it("offers to apply the answers that move something", async () => {
		// Arrange
		mock.onGet(QUESTIONS_URL).reply(200, {
			items: [
				{
					...question,
					answer: {
						answer: "merge",
						into: "course-test-2",
						decided_at: "2030-09-10T08:00:00Z",
					},
				},
			],
			next_after: null,
		});

		// Act
		renderQuestions();

		// Assert
		expect(
			await screen.findByText(/Чекає застосування внизу/),
		).toBeInTheDocument();
		expect(
			await screen.findByRole("button", { name: "Застосувати" }),
		).toBeEnabled();
	});
});

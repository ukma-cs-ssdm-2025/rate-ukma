import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type MockAdapter from "axios-mock-adapter";
import { afterEach, describe, expect, it } from "vitest";

import { mergeQuestion, otherCourse } from "./syncTestData";
import {
	answerUrl,
	bodyOf,
	mockSync,
	QUESTIONS_URL,
	renderSync,
} from "./syncTestRender";

let mock: MockAdapter;

afterEach(() => {
	mock.restore();
});

describe("duplicate pair desk saves", () => {
	it("ignores a second answer while the first one is saving", async () => {
		// Arrange
		const user = userEvent.setup();
		mock = mockSync();
		mock.onGet(QUESTIONS_URL).reply(200, {
			items: [mergeQuestion(), mergeQuestion({ id: 502 })],
			next_after: null,
		});
		mock
			.onPost(answerUrl(501))
			.reply(
				() =>
					new Promise((resolve) => setTimeout(() => resolve([200, {}]), 50)),
			);
		renderSync("?view=merge");

		// Act
		await screen.findByText("Пара 1 з 2 з оцінками");
		await user.keyboard("1");
		await user.keyboard("2");

		// Assert
		expect(
			await screen.findByText("Пара 2 з 2 з оцінками"),
		).toBeInTheDocument();
		expect(bodyOf(mock, answerUrl(501))).toEqual([
			{ answer: "merge", into: mergeQuestion().suggested_into },
		]);
	});

	it("answers a question as before when nothing is saving", async () => {
		// Arrange
		const user = userEvent.setup();
		mock = mockSync();
		mock
			.onGet(QUESTIONS_URL)
			.reply(200, { items: [mergeQuestion()], next_after: null });
		mock.onPost(answerUrl(501)).reply(200, {});
		renderSync("?view=merge");

		// Act
		await screen.findByText("Пара 1 з 1 з оцінками");
		await user.keyboard("2");

		// Assert
		await waitFor(() =>
			expect(bodyOf(mock, answerUrl(501))).toEqual([
				{ answer: "keep_apart", into: null },
			]),
		);
	});

	it("shows the saved destination, not the suggestion", async () => {
		// Arrange
		mock = mockSync();
		mock.onGet(QUESTIONS_URL).reply(200, {
			items: [
				mergeQuestion({
					answer: {
						answer: "merge",
						into: otherCourse.id,
						decided_at: "2026-11-21T10:00:00Z",
					},
				}),
			],
			next_after: null,
		});

		// Act
		renderSync("?view=merge");

		// Assert
		const stays = (await screen.findByText("Залишиться ця сторінка")).closest(
			"article",
		);
		expect(stays).not.toBeNull();
		expect(
			stays && within(stays).getByText(otherCourse.department),
		).toBeInTheDocument();
	});
});

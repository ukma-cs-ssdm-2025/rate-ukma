import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type MockAdapter from "axios-mock-adapter";
import { afterEach, describe, expect, it } from "vitest";

import type { SyncChange, SyncPendingResponse } from "@/lib/api/generated";
import {
	catalogRun,
	course,
	linkChange,
	linksPreview,
	listPage,
	mergeQuestion,
	otherCourse,
	placeQuestion,
} from "./syncTestData";
import {
	answerUrl,
	APPROVE_URL,
	BULK_URL,
	bodyOf,
	mockSync,
	PENDING_URL,
	PREVIEW_URL,
	QUESTIONS_URL,
	REJECT_URL,
	renderSync,
} from "./syncTestRender";

let mock: MockAdapter;

afterEach(() => {
	mock.restore();
});

const newRow = (id: number, title: string): SyncChange => ({
	...linkChange,
	id,
	group: "new",
	kind: "new_offering",
	after: {
		saz_code: `90${id}`,
		study_year: 2,
		semester: { year: 2019, term: "SPRING" },
		display: { course: { title, department: "Кафедра зразкових наук" } },
	},
});

const pending = (items: SyncChange[], total: number): SyncPendingResponse => ({
	...listPage(items, total),
	page_size: 12,
	total_pages: Math.ceil(total / 12),
	groups: {},
	kinds: {},
	runs: [catalogRun],
});

const applied = {
	id: 40,
	action: "apply",
	outcome: "applied",
	counts: { applied: 1 },
	error: "",
};

describe("new on the site", () => {
	it("toggles a row to skip and sends the skipped ids apart", async () => {
		// Arrange
		const user = userEvent.setup();
		mock = mockSync();
		mock
			.onGet(PENDING_URL)
			.reply(
				200,
				pending(
					[newRow(1, "Теорія зразків"), newRow(2, "Практика зразків")],
					681,
				),
			);
		mock.onPost(PREVIEW_URL).reply(200, linksPreview);
		mock.onPost(APPROVE_URL).reply(200, applied);
		mock.onPost(REJECT_URL).reply(200, { ...applied, action: "reject" });
		renderSync("?view=new");

		// Act
		const toggle = await screen.findByRole("radiogroup", {
			name: "Рішення: Теорія зразків",
		});
		await user.click(within(toggle).getByRole("radio", { name: "Пропустити" }));

		// Assert
		expect(
			within(toggle).getByRole("radio", { name: "Пропустити" }),
		).toHaveAttribute("aria-checked", "true");
		expect(screen.getByText(/з 681 · пропущено 1/)).toBeInTheDocument();
		await user.click(
			screen.getByRole("button", { name: "Додати 680 семестрів" }),
		);
		const dialog = await screen.findByRole("dialog");
		await user.click(
			await within(dialog).findByRole("button", { name: "Додати 680" }),
		);
		await waitFor(() => expect(bodyOf(mock, REJECT_URL)).toHaveLength(1));
		expect(bodyOf(mock, APPROVE_URL)[0]).toMatchObject({
			kind: "new_offering",
			selection: {
				filter: { group: "new", kind: "new_offering", exclude_ids: [1] },
			},
		});
		expect(bodyOf(mock, REJECT_URL)[0]).toMatchObject({
			selection: { change_ids: [1] },
		});
		expect(
			mock.history.get.find((call) => call.url === PENDING_URL)?.params,
		).toMatchObject({
			group: "new",
			kind: "new_offering",
			page_size: 12,
		});
	});
});

describe("new disciplines", () => {
	it("offers no year filter, since disciplines have no semester", async () => {
		// Arrange
		mock = mockSync();
		mock
			.onGet(PENDING_URL)
			.reply(200, pending([newRow(1, "Теорія зразків")], 178));
		renderSync("?view=new&segment=courses&years=current");

		// Act
		await screen.findByRole("radiogroup", { name: "Рішення: Теорія зразків" });

		// Assert
		expect(
			screen.queryByRole("radiogroup", { name: "Роки" }),
		).not.toBeInTheDocument();
		const params = mock.history.get.find(
			(call) => call.url === PENDING_URL,
		)?.params;
		expect(params).toMatchObject({ group: "new", kind: "new_course" });
		expect(params).not.toHaveProperty("year_from");
	});
});

describe("updated data", () => {
	it("keeps blanked fields by rejecting them with a previewed filter", async () => {
		// Arrange
		const user = userEvent.setup();
		mock = mockSync();
		mock.onPost(PREVIEW_URL).reply(200, { ...linksPreview, count: 892 });
		mock
			.onPost(REJECT_URL)
			.reply(200, { ...applied, action: "reject", counts: { rejected: 892 } });
		renderSync("?view=fields");

		// Act
		const keep = await screen.findByRole("button", { name: "Залишити як є" });
		expect(
			screen.getByText(/Семестр переїде в інший рік чи сезон/),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Очистити 892" }),
		).toBeInTheDocument();
		await user.click(keep);
		const dialog = await screen.findByRole("dialog");
		await user.click(
			await within(dialog).findByRole("button", { name: "Залишити 892 як є" }),
		);

		// Assert
		await waitFor(() => expect(bodyOf(mock, REJECT_URL)).toHaveLength(1));
		expect(bodyOf(mock, APPROVE_URL)).toHaveLength(0);
		expect(bodyOf(mock, REJECT_URL)[0]).toMatchObject({
			token: linksPreview.token,
			selection: {
				filter: {
					group: "change",
					changed_field: "practice_type",
					blanks: true,
				},
			},
		});
		expect(await screen.findByRole("status")).toHaveTextContent(
			/Готово: залишено як є 892/,
		);
	});
});

describe("duplicate pair desk", () => {
	it("answers with 1 and 2, skips with → and applies from a static bar", async () => {
		// Arrange
		const user = userEvent.setup();
		mock = mockSync();
		mock.onGet(QUESTIONS_URL).reply(200, {
			items: [
				mergeQuestion(),
				mergeQuestion({ id: 502 }),
				mergeQuestion({ id: 503 }),
			],
			next_after: null,
		});
		mock.onPost(answerUrl(501)).reply(200, {});
		mock.onPost(answerUrl(502)).reply(200, {});
		renderSync("?view=merge");

		// Act
		expect(
			await screen.findByText("Пара 1 з 3 з оцінками"),
		).toBeInTheDocument();
		expect(
			screen.getByText(
				"Ваших рішень поки немає. Вони зберігаються одразу, а на сайті змінюються, коли ви їх застосуєте.",
			),
		).toBeInTheDocument();
		await user.keyboard("1");
		await screen.findByText("Пара 2 з 3 з оцінками");
		await user.keyboard("2");
		await screen.findByText("Пара 3 з 3 з оцінками");
		await user.keyboard("{ArrowRight}");

		// Assert
		expect(
			await screen.findByText("Пара 1 з 3 з оцінками"),
		).toBeInTheDocument();
		expect(bodyOf(mock, answerUrl(501))[0]).toEqual({
			answer: "merge",
			into: course().id,
		});
		expect(bodyOf(mock, answerUrl(502))[0]).toEqual({
			answer: "keep_apart",
			into: null,
		});
		const apply = screen.getByRole("button", {
			name: "Застосувати рішення (2)",
		});
		expect(apply.closest(".sticky")).toBeNull();
		expect(screen.getByText("Залишиться ця сторінка")).toBeInTheDocument();
		expect(
			screen.getByText(/1 семестр з другої сторінки перейде на першу/),
		).toBeInTheDocument();
	});

	it("keeps the other page when asked", async () => {
		// Arrange
		const user = userEvent.setup();
		mock = mockSync();
		mock
			.onGet(QUESTIONS_URL)
			.reply(200, { items: [mergeQuestion()], next_after: null });
		mock.onPost(answerUrl(501)).reply(200, {});
		renderSync("?view=merge");

		// Act
		await user.click(
			await screen.findByRole("button", { name: "Залишити іншу" }),
		);
		await user.click(screen.getByRole("button", { name: /Об'єднати/ }));

		// Assert
		await waitFor(() =>
			expect(bodyOf(mock, answerUrl(501))[0]).toEqual({
				answer: "merge",
				into: otherCourse.id,
			}),
		);
	});
});

describe("pairs without ratings", () => {
	it("saves merge and apart answers, then confirms by filter", async () => {
		// Arrange
		const user = userEvent.setup();
		mock = mockSync();
		mock.onGet(QUESTIONS_URL).reply(200, {
			items: [
				mergeQuestion({ ratings: 0 }),
				mergeQuestion({ id: 502, ratings: 0 }),
			],
			next_after: null,
		});
		mock.onPost(BULK_URL).reply(200, { answered: 1, failed: 0 });
		mock.onPost(PREVIEW_URL).reply(200, { ...linksPreview, count: 2 });
		renderSync("?view=pairs");

		// Act
		const rows = await screen.findAllByRole("radiogroup", { name: /Рішення:/ });
		await user.click(within(rows[1]).getByRole("radio", { name: "Окремо" }));
		await user.click(screen.getByRole("button", { name: "Застосувати 2" }));

		// Assert
		const dialog = await screen.findByRole("dialog");
		expect(dialog).toHaveTextContent(/Об'єднати1/);
		expect(bodyOf(mock, BULK_URL)).toEqual([
			{ change_ids: [501], answer: "merge", into: "suggested" },
			{ change_ids: [502], answer: "keep_apart" },
		]);
		expect(screen.getByText(/з 2 · окремо 1/)).toBeInTheDocument();
	});
});

describe("semester without a course", () => {
	it("preselects nothing and rejects «none of them» on apply", async () => {
		// Arrange
		const user = userEvent.setup();
		mock = mockSync();
		mock
			.onGet(QUESTIONS_URL)
			.reply(200, { items: [placeQuestion()], next_after: null });
		mock.onPost(PREVIEW_URL).reply(200, { ...linksPreview, count: 1 });
		renderSync("?view=place");

		// Act
		const radios = await screen.findAllByRole("radio");
		const attach = screen.getByRole("button", { name: "Прикріпити" });

		// Assert
		expect(radios).toHaveLength(3);
		for (const radio of radios) {
			expect(radio).not.toBeChecked();
		}
		expect(attach).toBeDisabled();
		expect(
			screen.queryByRole("button", { name: /Застосувати рішення/ }),
		).not.toBeInTheDocument();
		await user.click(screen.getByRole("radio", { name: /Жодна не підходить/ }));
		expect(attach).toBeEnabled();
		await user.click(attach);
		await user.click(
			await screen.findByRole("button", { name: "Застосувати рішення (1)" }),
		);
		const dialog = await screen.findByRole("dialog");
		expect(dialog).toHaveTextContent(/Жодна не підходить1/);
		await waitFor(() =>
			expect(bodyOf(mock, PREVIEW_URL)).toEqual([
				{ source: "catalog", run: 7, selection: { change_ids: [601] } },
			]),
		);
	});
});

import type { ComponentType } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { authorizedHttpClient } from "@/lib/api/apiClient";
import { getAuthSessionRetrieveQueryKey } from "@/lib/api/generated";
import type { Session, UkmaDataReviewCasePage } from "@/lib/api/generated";
import {
	casePage,
	removalCase,
	serveCases,
	studentCase,
} from "@/features/ukma-data/components/caseTestData";
import { notifySessionExpired } from "@/lib/auth/sessionExpiry";
import { Route } from "./data.cases.index";

vi.mock("@tanstack/react-router", async () => ({
	createFileRoute: () => (options: object) => options,
	Link: (await import("@/test-utils/router")).MockLink,
}));

vi.mock("@/lib/auth/sessionExpiry", () => ({
	notifySessionExpired: vi.fn(),
}));

const URL = "/api/v1/ukma-data/review-cases/";
const SESSION_URL = "/api/v1/auth/session/";

const PAGE: UkmaDataReviewCasePage = casePage([
	studentCase(1),
	{ ...studentCase(2), status: "decided", decision_id: "dec-test-1" },
	removalCase,
]);

const ReviewCases = (Route as unknown as { component: ComponentType })
	.component;

let mockAxios: MockAdapter;

function renderCases(search = "?status=all") {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	const { unmount } = render(
		<QueryClientProvider client={queryClient}>
			<NuqsTestingAdapter searchParams={search} hasMemory>
				<ReviewCases />
			</NuqsTestingAdapter>
		</QueryClientProvider>,
	);
	return { queryClient, unmount };
}

beforeEach(() => {
	mockAxios = new MockAdapter(authorizedHttpClient);
});

afterEach(() => {
	mockAxios.restore();
	vi.clearAllMocks();
});

describe("/data/cases", () => {
	it("lists open cases as compact rows named in words", async () => {
		serveCases(mockAxios, PAGE.items);

		renderCases("");

		const rows = await screen.findAllByRole("row");
		expect(rows).toHaveLength(3);
		expect(rows[1]).toHaveTextContent(
			"Новий запис студента схожий на наявного",
		);
		expect(rows[1]).toHaveTextContent(
			"Збігся з 2 студентами · Отримано 2 вер.",
		);
		expect(rows[1]).toHaveTextContent("Чекає рішення");
		expect(rows[2]).toHaveTextContent(
			"САЗ більше не показує 3 семестри 2029–2030",
		);
		expect(document.body).not.toHaveTextContent("case-st-1");
		expect(document.body).not.toHaveTextContent("UKMA Data");
		expect(screen.getByText("Залишилось вирішити")).toHaveTextContent("2");
		expect(mockAxios.history.get[0].params).toEqual({
			limit: 1000,
			status: "open",
		});
	});

	it("filters by status and kind segments from the URL", async () => {
		serveCases(mockAxios, PAGE.items);

		renderCases("?status=all&kind=student_match");

		const rows = await screen.findAllByRole("row");
		expect(rows).toHaveLength(3);
		expect(rows[2]).toHaveTextContent("Вирішено");
		expect(
			mockAxios.history.get.some(
				(request) =>
					request.params.limit === 1000 &&
					request.params.kind === "student_match" &&
					request.params.status === undefined,
			),
		).toBe(true);
		expect(screen.getByRole("radio", { name: /Студенти/ })).toHaveAttribute(
			"aria-checked",
			"true",
		);
	});

	it("switches the status segment", async () => {
		serveCases(mockAxios, PAGE.items);
		renderCases("");
		await screen.findAllByRole("row");

		await userEvent.click(screen.getByRole("radio", { name: /Вирішені/ }));

		await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(2));
		const rows = screen.getAllByRole("row");
		expect(rows[1]).toHaveTextContent("Вирішено");
	});

	it("searches by the words of a case", async () => {
		serveCases(mockAxios, PAGE.items);
		renderCases("");
		await screen.findAllByRole("row");

		fireEvent.change(screen.getByRole("searchbox"), {
			target: { value: "семестри" },
		});

		await waitFor(() => expect(screen.queryAllByRole("row")).toHaveLength(2));
	});

	it("pages through 20 rows at a time", async () => {
		mockAxios
			.onGet(URL)
			.reply(
				200,
				casePage(Array.from({ length: 45 }, (_, index) => studentCase(index))),
			);

		renderCases("?page=3");

		expect(await screen.findAllByRole("row")).toHaveLength(6);
		expect(screen.getByText("41–45 з 45")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "3" })).toHaveAttribute(
			"aria-current",
			"page",
		);
	});

	it("says when nothing is waiting", async () => {
		serveCases(mockAxios, []);

		renderCases("");

		expect(
			await screen.findByText(/Справ немає: усе, що прийшло з САЗ/),
		).toBeInTheDocument();
		expect(screen.queryByText("Нічого не знайдено")).not.toBeInTheDocument();
	});

	it("keeps the filters with real counts when no case is open", async () => {
		serveCases(mockAxios, [
			{ ...studentCase(1), status: "decided" },
			{ ...studentCase(2), status: "decided" },
			{ ...removalCase, status: "obsolete" },
		]);

		renderCases("");

		expect(
			await screen.findByText("За цим фільтром справ немає"),
		).toBeInTheDocument();
		expect(screen.queryByText("Нічого не знайдено")).not.toBeInTheDocument();
		const state = screen.getByRole("radiogroup", { name: "Стан" });
		await waitFor(() =>
			expect(state).toHaveTextContent("Чекають0Вирішені2Неактуальні1Усі3"),
		);
		expect(screen.getByRole("radiogroup", { name: "Тип" })).toHaveTextContent(
			/^Усі0.*Студенти0/,
		);
		expect(screen.getByText("Стан")).toBeVisible();
		expect(screen.getByText("Тип")).toBeVisible();
	});

	it("asks the server for the filter and counts what remains from the open total", async () => {
		const open = Array.from({ length: 1200 }, (_, index) =>
			studentCase(index, {
				opened_at: new Date(
					Date.UTC(2030, 0, 1) + index * 60_000,
				).toISOString(),
			}),
		);
		serveCases(mockAxios, open);

		renderCases("");

		await screen.findAllByRole("row");
		await waitFor(() =>
			expect(screen.getByText("Залишилось вирішити")).toHaveTextContent(
				"1 200",
			),
		);
		expect(
			mockAxios.history.get.filter(
				(request) =>
					request.params.limit === 1000 && request.params.status === "open",
			),
		).not.toHaveLength(0);
	});

	it("puts open cases oldest first", async () => {
		serveCases(mockAxios, [
			studentCase(1, { opened_at: "2030-09-05T10:00:00Z" }),
			studentCase(2, { opened_at: "2030-09-01T10:00:00Z" }),
			studentCase(3, { opened_at: "2030-09-03T10:00:00Z" }),
		]);

		renderCases("");

		const rows = await screen.findAllByRole("row");
		expect(rows.slice(1).map((row) => row.textContent)).toEqual([
			expect.stringContaining("Отримано 1 вер."),
			expect.stringContaining("Отримано 3 вер."),
			expect.stringContaining("Отримано 5 вер."),
		]);
	});

	it("links each case with the list's page and filters", async () => {
		serveCases(
			mockAxios,
			Array.from({ length: 25 }, (_, index) => studentCase(index)),
		);

		renderCases("?page=2&q=запис");

		const rows = await screen.findAllByRole("row");
		expect(within(rows[1]).getByRole("link")).toHaveAttribute(
			"data-search",
			JSON.stringify({ kind: "all", status: "open", q: "запис", page: 2 }),
		);
	});

	it("explains what a case is", async () => {
		serveCases(mockAxios, PAGE.items);

		renderCases("");

		expect(await screen.findByText("Що це?")).toBeInTheDocument();
		expect(
			screen.getByText(/Поки справу не вирішено, діє безпечна відповідь/),
		).toBeInTheDocument();
	});

	it("says how many of the matching cases it shows", async () => {
		mockAxios.onGet(URL).reply(200, { ...PAGE, has_more: true, total: 1500 });

		renderCases();

		expect(
			await screen.findByText("Показано перші 3 з 1 500 справ."),
		).toBeInTheDocument();
	});

	it("says UKMA Data is down on 502", async () => {
		mockAxios.onGet(URL).reply(502, { detail: "x", status: 502 });

		renderCases();

		expect(
			await screen.findByText("Дані САЗ зараз недоступні"),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Спробувати знову" }),
		).toBeInTheDocument();
	});

	it("replaces the cached list with the error when a refresh fails", async () => {
		mockAxios.onGet(URL).replyOnce(200, PAGE).onGet(URL).reply(502);

		const { queryClient } = renderCases();
		expect(await screen.findAllByRole("row")).toHaveLength(4);

		await queryClient.refetchQueries();

		expect(
			await screen.findByText("Дані САЗ зараз недоступні"),
		).toBeInTheDocument();
		expect(screen.queryAllByRole("row")).toHaveLength(0);
	});

	it("says UKMA Data is not configured on 503", async () => {
		mockAxios.onGet(URL).reply(503, { detail: "x", status: 503 });

		renderCases();

		expect(
			await screen.findByText("Доступ до даних САЗ не налаштовано"),
		).toBeInTheDocument();
	});

	it("says the UKMA Data key has no access to cases on ukma_data_forbidden", async () => {
		mockAxios.onGet(URL).reply(403, {
			detail: "Ключ UKMA Data цього сервера не має доступу до цього розділу",
			code: "ukma_data_forbidden",
			status: 403,
		});

		renderCases();

		expect(
			await screen.findByText("Немає доступу до цих даних"),
		).toBeInTheDocument();
		expect(
			screen.getByText(/У сайту немає дозволу бачити цей розділ/),
		).toBeInTheDocument();
		expect(
			screen.queryByText("Розділ лише для суперкористувачів"),
		).not.toBeInTheDocument();
		expect(notifySessionExpired).not.toHaveBeenCalled();
		expect(
			mockAxios.history.get.some((request) =>
				request.url?.includes("/auth/session"),
			),
		).toBe(false);
	});

	it("shows the superusers-only page on 403 with a null body", async () => {
		const session: Session = {
			is_authenticated: true,
			user: null,
			is_student: true,
			is_superuser: false,
			speciality: null,
		};
		mockAxios.onGet(URL).reply(403, null);
		mockAxios.onGet(SESSION_URL).reply(200, session);

		renderCases();

		expect(
			await screen.findByText("Розділ лише для суперкористувачів"),
		).toBeInTheDocument();
	});

	it("shows the superusers-only page on 403 while the session lasts", async () => {
		const session: Session = {
			is_authenticated: true,
			user: null,
			is_student: true,
			is_superuser: false,
			speciality: null,
		};
		mockAxios.onGet(URL).reply(403, { detail: "x", status: 403 });
		mockAxios.onGet(SESSION_URL).reply(200, session);

		const { queryClient } = renderCases();

		expect(
			await screen.findByText("Розділ лише для суперкористувачів"),
		).toBeInTheDocument();
		await waitFor(() =>
			expect(
				queryClient.getQueryData(getAuthSessionRetrieveQueryKey()),
			).toEqual(session),
		);
		expect(notifySessionExpired).not.toHaveBeenCalled();
	});

	it("does not write a late session answer after the section unmounts", async () => {
		const session: Session = {
			is_authenticated: true,
			user: null,
			is_student: true,
			is_superuser: false,
			speciality: null,
		};
		let answer: () => void = () => {};
		mockAxios.onGet(URL).reply(403, { detail: "x", status: 403 });
		mockAxios.onGet(SESSION_URL).reply(
			() =>
				new Promise((resolve) => {
					answer = () => resolve([200, session]);
				}),
		);

		const { queryClient, unmount } = renderCases();
		await waitFor(() =>
			expect(
				mockAxios.history.get.some((request) => request.url === SESSION_URL),
			).toBe(true),
		);
		unmount();
		answer();
		await new Promise((resolve) => setTimeout(resolve, 20));

		expect(queryClient.getQueryData(getAuthSessionRetrieveQueryKey())).toBe(
			undefined,
		);
	});

	it("signs the user out on 403 when the session has ended", async () => {
		mockAxios.onGet(URL).reply(403, { detail: "x", status: 403 });
		mockAxios.onGet(SESSION_URL).reply(401);

		renderCases();

		await waitFor(() => expect(notifySessionExpired).toHaveBeenCalledOnce());
	});
});

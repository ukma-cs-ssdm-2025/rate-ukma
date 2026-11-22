import type { ComponentType } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
		mockAxios.onGet(URL).reply(200, PAGE);

		renderCases("");

		const rows = await screen.findAllByRole("row");
		expect(rows).toHaveLength(3);
		expect(rows[1]).toHaveTextContent(
			"Новий запис студента схожий на наявного",
		);
		expect(rows[1]).toHaveTextContent("Збігся з 2 студентами");
		expect(rows[1]).toHaveTextContent("Чекає рішення");
		expect(rows[2]).toHaveTextContent(
			"САЗ більше не показує 3 семестри 2029–2030",
		);
		expect(document.body).not.toHaveTextContent("case-st-1");
		expect(document.body).not.toHaveTextContent("UKMA Data");
		expect(screen.getByText("Залишилось вирішити")).toHaveTextContent("2");
		expect(mockAxios.history.get[0].params).toEqual({ limit: 1000 });
	});

	it("filters by status and kind segments from the URL", async () => {
		mockAxios.onGet(URL).reply(200, PAGE);

		renderCases("?status=all&kind=student_match");

		const rows = await screen.findAllByRole("row");
		expect(rows).toHaveLength(3);
		expect(rows[2]).toHaveTextContent("Вирішено");
		expect(screen.getByRole("radio", { name: /Студенти/ })).toHaveAttribute(
			"aria-checked",
			"true",
		);
	});

	it("switches the status segment", async () => {
		mockAxios.onGet(URL).reply(200, PAGE);
		renderCases("");
		await screen.findAllByRole("row");

		await userEvent.click(screen.getByRole("radio", { name: /Вирішені/ }));

		const rows = screen.getAllByRole("row");
		expect(rows).toHaveLength(2);
		expect(rows[1]).toHaveTextContent("Вирішено");
	});

	it("searches by the words of a case", async () => {
		mockAxios.onGet(URL).reply(200, PAGE);
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
		mockAxios.onGet(URL).reply(200, casePage([]));

		renderCases("");

		expect(
			await screen.findByText(/Справ немає: усе, що прийшло з САЗ/),
		).toBeInTheDocument();
	});

	it("explains what a case is", async () => {
		mockAxios.onGet(URL).reply(200, PAGE);

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
			screen.getByText(/не дає права бачити цей розділ/),
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
		await waitFor(() => expect(mockAxios.history.get).toHaveLength(2));
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

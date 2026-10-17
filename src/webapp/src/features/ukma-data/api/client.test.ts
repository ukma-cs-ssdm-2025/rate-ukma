import MockAdapter from "axios-mock-adapter";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ReviewCase } from "./schemas";

const OFFERING = {
	id: "off_1",
	sazCode: "900001",
	academicYear: 2026,
	title: "Вигаданий курс",
	department: "Вигадана кафедра",
	credits: 4,
	courseId: "crs_1",
};

const COURSE_MATCH: ReviewCase = {
	id: "rev_1",
	kind: "course_match",
	status: "open",
	openedAt: "2026-10-17T05:00:00Z",
	runId: 1,
	decisionId: null,
	subject: OFFERING,
	candidate: { ...OFFERING, id: "off_2", courseId: "crs_2" },
};

const OVERVIEW = {
	lastSync: { finishedAt: "2026-10-17T05:04:00Z", cursor: 10, ok: true },
	dataUpdatedAt: "2026-10-17T09:01:00Z",
	lists: [{ name: "courses", rows: 3 }],
	openCases: { course_match: 1, instructor_match: 0, removals_held: 0 },
	oldestOpenAt: null,
};

const DECISION = {
	id: "dec_1",
	kind: "merge",
	reviewCaseId: "rev_1",
	reversesId: null,
	madeAt: "2026-10-17T10:00:00Z",
	keyName: "rate-ukma",
	staffUser: { id: 1, name: "Тестовий Адмін" },
	changeNo: 11,
	rows: [{ list: "offerings", id: "off_1", change: "курс crs_1 → crs_2" }],
};

/** Imports the client fresh, so it reads the stubbed env, with HTTP mocked. */
async function loadClient(source?: string) {
	vi.resetModules();
	vi.stubEnv("VITE_UKMA_DATA_SOURCE", source);
	const { authorizedHttpClient } = await import("@/lib/api/apiClient");
	const http = new MockAdapter(authorizedHttpClient);
	const client = await import("./client");
	return { ...client, http };
}

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("VITE_UKMA_DATA_SOURCE", () => {
	it.each(["development", "staging", "live"])(
		"calls the API when unset on %s",
		async (environment) => {
			vi.stubEnv("VITE_ENVIRONMENT", environment);
			const { ukmaDataClient, isUkmaDataMocked, http } = await loadClient();
			http.onGet("/api/v1/data/overview/").reply(200, OVERVIEW);

			await expect(ukmaDataClient.overview()).resolves.toEqual(OVERVIEW);
			expect(isUkmaDataMocked).toBe(false);
			expect(http.history.get).toHaveLength(1);
		},
	);

	it("calls the API when set to api", async () => {
		const { ukmaDataClient, http } = await loadClient("api");
		http.onGet("/api/v1/data/overview/").reply(200, OVERVIEW);

		await ukmaDataClient.overview();

		expect(http.history.get).toHaveLength(1);
	});

	it("serves invented data without HTTP when set to mock", async () => {
		const { ukmaDataClient, isUkmaDataMocked, http } = await loadClient("mock");

		const cases = await ukmaDataClient.reviewCases({});

		expect(isUkmaDataMocked).toBe(true);
		expect(cases.length).toBeGreaterThan(0);
		expect(http.history.get).toHaveLength(0);
	});
});

describe("API responses", () => {
	it("unwraps a page of review cases and sends the filter", async () => {
		const { ukmaDataClient, http } = await loadClient();
		http
			.onGet("/api/v1/data/review-cases/")
			.reply(200, { items: [COURSE_MATCH] });

		await expect(
			ukmaDataClient.reviewCases({ kind: "course_match", status: "open" }),
		).resolves.toEqual([COURSE_MATCH]);
		expect(http.history.get[0].params).toEqual({
			kind: "course_match",
			status: "open",
		});
	});

	it("posts a decision and parses the result", async () => {
		const { ukmaDataClient, http } = await loadClient();
		http.onPost("/api/v1/data/decisions/").reply(201, DECISION);

		await expect(
			ukmaDataClient.decide({ kind: "merge", reviewCaseId: "rev_1" }),
		).resolves.toEqual(DECISION);
		expect(JSON.parse(http.history.post[0].data)).toEqual({
			kind: "merge",
			reviewCaseId: "rev_1",
		});
	});

	it.each([
		["an unknown case kind", { ...COURSE_MATCH, kind: "title_match" }],
		[
			"a course match without its candidate",
			{ ...COURSE_MATCH, candidate: undefined },
		],
		["an unknown status", { ...COURSE_MATCH, status: "closed" }],
	])("rejects a review case with %s", async (_, body) => {
		const { ukmaDataClient, http } = await loadClient();
		http.onGet("/api/v1/data/review-cases/rev_1/").reply(200, body);

		await expect(ukmaDataClient.reviewCase("rev_1")).rejects.toThrow();
	});

	it("counts a kind the overview leaves out as zero", async () => {
		const { ukmaDataClient, http } = await loadClient();
		http.onGet("/api/v1/data/overview/").reply(200, {
			...OVERVIEW,
			openCases: { course_match: 2 },
		});

		await expect(ukmaDataClient.overview()).resolves.toMatchObject({
			openCases: { course_match: 2, instructor_match: 0, removals_held: 0 },
		});
	});

	it("rejects an overview whose counts are not integers", async () => {
		const { ukmaDataClient, http } = await loadClient();
		http.onGet("/api/v1/data/overview/").reply(200, {
			...OVERVIEW,
			openCases: { ...OVERVIEW.openCases, course_match: "1" },
		});

		await expect(ukmaDataClient.overview()).rejects.toThrow();
	});

	it("rejects a decisions page that is a bare array", async () => {
		const { ukmaDataClient, http } = await loadClient();
		http.onGet("/api/v1/data/decisions/").reply(200, [DECISION]);

		await expect(ukmaDataClient.decisions({})).rejects.toThrow();
	});
});

import type { UkmaDataClient } from "./client";
import { MOCK_CASES, MOCK_DECISIONS, MOCK_LISTS } from "./mockData";
import {
	type CaseKind,
	caseKinds,
	type Decision,
	type DecisionInput,
	type ReviewCase,
} from "./schemas";

const MOCK_STAFF = { id: 7, name: "Демо Адміністратор" };
const LATENCY_MS = 150;

interface MockState {
	readonly cases: ReviewCase[];
	readonly decisions: Decision[];
	readonly changeNo: number;
}

function changedRows(
	reviewCase: ReviewCase,
	input: DecisionInput,
): Decision["rows"] {
	switch (input.kind) {
		case "merge":
			if (reviewCase.kind !== "course_match") return [];
			return [
				{
					list: "offerings",
					id: reviewCase.subject.id,
					change: `курс ${reviewCase.subject.courseId} → ${reviewCase.candidate.courseId}`,
				},
				{
					list: "courses",
					id: reviewCase.subject.courseId,
					change: `вилучено, mergedInto ${reviewCase.candidate.courseId}`,
				},
			];
		case "split":
			if (reviewCase.kind !== "course_match") return [];
			return [
				{
					list: "offerings",
					id: reviewCase.subject.id,
					change: `курс ${reviewCase.subject.courseId} → crs_${reviewCase.subject.sazCode}`,
				},
				{
					list: "courses",
					id: `crs_${reviewCase.subject.sazCode}`,
					change: "створено",
				},
			];
		case "link_instructor":
			if (reviewCase.kind !== "instructor_match") return [];
			return [
				{
					list: "instructor_links",
					id: `${input.instructorId}:${reviewCase.subject.id}`,
					change: "додано",
				},
			];
		case "apply_removals":
			if (reviewCase.kind !== "removals_held") return [];
			return reviewCase.offerings.map((item) => ({
				list: "offerings",
				id: item.id,
				change: "вилучено",
			}));
		default:
			return [];
	}
}

/** Pure step behind the mock: records the decision and closes its case. */
export function applyDecision(
	state: MockState,
	input: DecisionInput,
	madeAt: string,
): MockState {
	const target = state.cases.find((item) => item.id === input.reviewCaseId);
	if (!target) throw new Error(`Review case ${input.reviewCaseId} not found`);
	const changeNo = state.changeNo + 1;
	const decision: Decision = {
		id: `dec_${changeNo}`,
		kind: input.kind,
		reviewCaseId: target.id,
		reversesId: input.reversesId ?? null,
		madeAt,
		keyName: "rate-ukma",
		staffUser: MOCK_STAFF,
		changeNo,
		rows: changedRows(target, input),
	};
	let closed: ReviewCase = {
		...target,
		status: "decided",
		decisionId: decision.id,
	};
	if (
		closed.kind === "course_match" &&
		(input.kind === "merge" || input.kind === "split")
	) {
		const courseId =
			input.kind === "merge"
				? closed.candidate.courseId
				: `crs_${closed.subject.sazCode}`;
		closed = { ...closed, subject: { ...closed.subject, courseId } };
	}
	return {
		cases: state.cases.map((item) => (item.id === target.id ? closed : item)),
		decisions: [decision, ...state.decisions],
		changeNo,
	};
}

const later = <T>(value: () => T) =>
	new Promise<T>((resolve, reject) =>
		setTimeout(() => {
			try {
				resolve(value());
			} catch (error) {
				reject(error);
			}
		}, LATENCY_MS),
	);

export function createMockClient(): UkmaDataClient {
	let state: MockState = {
		cases: MOCK_CASES,
		decisions: MOCK_DECISIONS,
		changeNo: 48213,
	};
	const findCase = (id: string) => {
		const found = state.cases.find((item) => item.id === id);
		if (!found) throw new Error(`Review case ${id} not found`);
		return found;
	};

	return {
		overview: () =>
			later(() => {
				const open = state.cases.filter((item) => item.status === "open");
				return {
					lastSync: {
						finishedAt: "2026-10-17T05:04:00Z",
						cursor: state.changeNo,
						ok: true,
					},
					dataUpdatedAt: "2026-10-17T09:01:00Z",
					lists: MOCK_LISTS,
					openCases: Object.fromEntries(
						caseKinds.map((kind) => [
							kind,
							open.filter((item) => item.kind === kind).length,
						]),
					) as Record<CaseKind, number>,
					oldestOpenAt: open.map((item) => item.openedAt).sort()[0] ?? null,
				};
			}),
		reviewCases: (filter) =>
			later(() =>
				state.cases.filter(
					(item) =>
						(!filter.kind || item.kind === filter.kind) &&
						(!filter.status || item.status === filter.status),
				),
			),
		reviewCase: (id) => later(() => findCase(id)),
		decisions: (filter) =>
			later(() =>
				state.decisions.filter(
					(item) =>
						!filter.reviewCaseId || item.reviewCaseId === filter.reviewCaseId,
				),
			),
		decide: (input) =>
			later(() => {
				state = applyDecision(state, input, new Date().toISOString());
				return state.decisions[0];
			}),
	};
}

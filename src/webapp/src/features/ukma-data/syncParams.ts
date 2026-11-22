import {
	parseAsArrayOf,
	parseAsBoolean,
	parseAsInteger,
	parseAsString,
	parseAsStringEnum,
} from "nuqs";

import { SyncSourceEnum } from "@/lib/api/generated";
import { SYNC_KINDS } from "./syncLabels";
import { REVIEW_STEPS } from "./syncReview";

export const SYNC_TABS = ["review", "history", "rules"] as const;

export const URL_OPTIONS = { history: "push" } as const;

export const tabParser = parseAsStringEnum([...SYNC_TABS])
	.withDefault("review")
	.withOptions(URL_OPTIONS);

export const reviewParams = {
	source: parseAsStringEnum(Object.values(SyncSourceEnum))
		.withDefault("catalog")
		.withOptions(URL_OPTIONS),
	run: parseAsInteger.withOptions(URL_OPTIONS),
	group: parseAsStringEnum([...REVIEW_STEPS]).withOptions(URL_OPTIONS),
	question: parseAsString.withOptions(URL_OPTIONS),
};

export const listParams = {
	kind: parseAsStringEnum([...SYNC_KINDS]).withOptions(URL_OPTIONS),
	facet: parseAsStringEnum(["similar"]).withOptions(URL_OPTIONS),
	q: parseAsString.withDefault("").withOptions(URL_OPTIONS),
	rated: parseAsBoolean.withDefault(false).withOptions(URL_OPTIONS),
	view: parseAsStringEnum(["sample", "all"])
		.withDefault("sample")
		.withOptions(URL_OPTIONS),
	seed: parseAsInteger.withDefault(1).withOptions(URL_OPTIONS),
	page: parseAsInteger.withDefault(1).withOptions(URL_OPTIONS),
	ids: parseAsArrayOf(parseAsInteger).withDefault([]).withOptions(URL_OPTIONS),
};

export const LIST_RESET = {
	kind: null,
	facet: null,
	q: null,
	rated: null,
	view: null,
	seed: null,
	page: null,
	ids: null,
} as const;

export const historyParams = {
	openRun: parseAsInteger.withOptions(URL_OPTIONS),
	mine: parseAsBoolean.withDefault(false).withOptions(URL_OPTIONS),
};

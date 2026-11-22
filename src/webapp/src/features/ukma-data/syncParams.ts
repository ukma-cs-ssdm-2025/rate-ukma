import {
	parseAsBoolean,
	parseAsInteger,
	parseAsString,
	parseAsStringEnum,
} from "nuqs";

import { SyncChangeStateEnum } from "@/lib/api/generated";
import { SYNC_VIEWS } from "./syncGroups";
import { YEAR_RANGES } from "./syncRows";

export const SYNC_TABS = ["pending", "history", "rules"] as const;

export const URL_OPTIONS = { history: "push" } as const;

export const tabParser = parseAsStringEnum([...SYNC_TABS])
	.withDefault("pending")
	.withOptions(URL_OPTIONS);

export const LIST_SEGMENTS = ["courses", "offerings"] as const;

export type ListSegment = (typeof LIST_SEGMENTS)[number];

export const viewParams = {
	view: parseAsStringEnum([...SYNC_VIEWS])
		.withDefault("overview")
		.withOptions(URL_OPTIONS),
	segment: parseAsStringEnum([...LIST_SEGMENTS]).withOptions(URL_OPTIONS),
	years: parseAsStringEnum([...YEAR_RANGES])
		.withDefault("all")
		.withOptions(URL_OPTIONS),
	q: parseAsString.withDefault("").withOptions(URL_OPTIONS),
	page: parseAsInteger.withDefault(1).withOptions(URL_OPTIONS),
	field: parseAsString.withOptions(URL_OPTIONS),
	blanks: parseAsBoolean.withOptions(URL_OPTIONS),
};

export const VIEW_RESET = {
	segment: null,
	years: null,
	q: null,
	page: null,
	field: null,
	blanks: null,
} as const;

export const historyParams = {
	openRun: parseAsInteger.withOptions(URL_OPTIONS),
	mine: parseAsBoolean.withDefault(false).withOptions(URL_OPTIONS),
};

export const changeParams = {
	state: parseAsStringEnum([...Object.values(SyncChangeStateEnum), "all"])
		.withDefault("all")
		.withOptions(URL_OPTIONS),
	page: parseAsInteger.withDefault(1).withOptions(URL_OPTIONS),
};

export const changeUrlKeys = {
	urlKeys: { page: "changesPage", state: "changesState" },
} as const;

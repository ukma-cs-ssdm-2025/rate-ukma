import {
	FAILED_RUN_LABELS,
	FAILED_RUN_REASONS,
	HOLDERS,
	SKIP_REASON_LABELS,
	SKIP_REASONS,
	SUPERSEDED_REASON_LABELS,
	SUPERSEDED_REASONS,
} from "./syncLabels";
import type {
	FailedRunReason,
	Holder,
	SkipReason,
	SupersededReason,
} from "./syncLabels";
import { numberAt, readPath } from "./sync";

export interface Conflict {
	detail: string;
	selectionChanged: boolean;
	holder: Holder | null;
	runAgeHours: number | null;
}

const isHolder = (value: unknown): value is Holder =>
	HOLDERS.some((holder) => holder === value);

export function parseConflict(body: unknown): Conflict | null {
	const detail = readPath(body, "detail");
	if (typeof detail !== "string") {
		return null;
	}
	const holder = readPath(body, "holder");
	return {
		detail,
		selectionChanged: readPath(body, "code") === "selection_changed",
		holder: isHolder(holder) ? holder : null,
		runAgeHours: numberAt(body, "run_age_hours"),
	};
}

const isSkipReason = (value: string): value is SkipReason =>
	SKIP_REASONS.some((reason) => reason === value);

const isSupersededReason = (value: string): value is SupersededReason =>
	SUPERSEDED_REASONS.some((reason) => reason === value);

export const skipReasonLabel = (reason: string): string =>
	isSkipReason(reason) ? SKIP_REASON_LABELS[reason] : reason;

export const supersededReasonLabel = (reason: string): string =>
	isSupersededReason(reason) ? SUPERSEDED_REASON_LABELS[reason] : reason;

export function failedRunLabel(error: string): string {
	const reason: FailedRunReason | undefined = FAILED_RUN_REASONS.find((known) =>
		error.startsWith(known),
	);
	return reason === undefined
		? "Запуск не завершився"
		: FAILED_RUN_LABELS[reason];
}

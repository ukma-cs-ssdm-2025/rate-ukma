import {
	FAILED_RUN_LABELS,
	FAILED_RUN_REASONS,
	SKIP_REASON_LABELS,
	SKIP_REASONS,
	SUPERSEDED_REASON_LABELS,
	SUPERSEDED_REASONS,
} from "./syncLabels";
import type {
	FailedRunReason,
	SkipReason,
	SupersededReason,
} from "./syncLabels";

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

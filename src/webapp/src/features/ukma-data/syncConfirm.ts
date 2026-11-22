import type {
	SyncApproval,
	SyncChangeGroupEnum,
	SyncPreviewResponse,
	SyncSelection,
} from "@/lib/api/generated";
import { fieldLabel } from "./syncFields";
import { formatCount } from "./syncFormat";
import type { GroupKey, Part } from "./syncGroups";
import { partsPhrase, partsTotal } from "./syncGroups";
import { approvalCounts } from "./syncReview";

export interface ConfirmRequest {
	group: GroupKey;
	title: string;
	parts: Part[];
	ticks: string[];
	confirmLabel: string;
	verb: string;
	consequence: string;
	approve: {
		selection: SyncSelection;
		group: SyncChangeGroupEnum | null;
		kind: string | null;
	} | null;
	reject: SyncSelection | null;
	field: FieldScope | null;
}

export interface FieldScope {
	name: string;
	skip: boolean;
}

export function alsoLines(
	scope: FieldScope,
	preview: Pick<SyncPreviewResponse, "field_counts"> | null,
): string[] {
	if (preview === null) {
		return [];
	}
	const lead = scope.skip ? "Також залишиться як є" : "Також оновиться";
	return Object.entries(preview.field_counts)
		.filter(([name, count]) => name !== scope.name && count > 0)
		.sort(([, left], [, right]) => right - left)
		.map(
			([name, count]) =>
				`${lead}: ${fieldLabel(name).toLowerCase()} — ${formatCount(count)}`,
		);
}

export interface DoneBanner {
	group: GroupKey;
	title: string;
	detail: string;
	runId: number;
}

export function bannerFor(
	request: ConfirmRequest,
	results: readonly SyncApproval[],
	runId: number,
): DoneBanner {
	const totals = results.reduce(
		(sum, result) => {
			const counts = approvalCounts(result.counts);
			return {
				done: sum.done + counts.applied + counts.rejected,
				waiting: sum.waiting + counts.waiting,
			};
		},
		{ done: 0, waiting: 0 },
	);
	const waiting =
		totals.waiting > 0
			? ` Ще ${formatCount(totals.waiting)} чекають на інші зміни.`
			: "";
	return {
		group: request.group,
		title: `Готово: ${request.verb} ${formatCount(totals.done)}`,
		detail: `${partsPhrase(request.parts)}. ${request.consequence}${waiting}`,
		runId,
	};
}

export function previewNote(expected: number, found: number | null): string {
	if (found === null) {
		return "Перевіряємо, чи список не змінився…";
	}
	if (found === expected) {
		return "Список той самий, що ви бачили: за цей час нічого не змінилось.";
	}
	return `Список змінився, поки ви його переглядали: тепер ${formatCount(found)} замість ${formatCount(expected)}. Підтвердження застосує саме цей новий список.`;
}

export const requestTotal = (request: ConfirmRequest): number =>
	partsTotal(request.parts);

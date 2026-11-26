import type {
	SyncChange,
	SyncDecisionCounts,
	SyncDecisionResponse,
	SyncJournalEntry,
	SyncPreviewResponse,
	SyncRunAge,
} from "@/lib/api/generated";
import { SYNC_URL, titleChange } from "./dataTestData";

export const PREVIEW_URL = `${SYNC_URL}/preview/`;
export const APPLY_URL = `${SYNC_URL}/apply/`;
export const REJECT_URL = `${SYNC_URL}/reject/`;
export const REVERT_URL = `${SYNC_URL}/revert/`;
export const JOURNAL_URL = `${SYNC_URL}/journal/`;

export const changesFrom = (count: number): SyncChange[] =>
	Array.from({ length: count }, (_, index) => ({
		...titleChange,
		id: 48_121 + index,
	}));

export const decisionCounts = (
	overrides: Partial<SyncDecisionCounts> = {},
): SyncDecisionCounts => ({
	applied: 0,
	rejected: 0,
	skipped: 0,
	waiting: 0,
	superseded: 0,
	remaining: 0,
	total: 0,
	by_kind: [],
	...overrides,
});

export const previewRun: SyncRunAge = {
	id: 7,
	source: "catalog",
	finished_at: "2030-09-10T09:00:00Z",
	data_updated_at: "2030-09-10T09:00:00Z",
	age_hours: 3,
};

export const linkCounts = decisionCounts({
	applied: 1532,
	total: 1532,
	by_kind: [
		{ kind: "link_course", count: 559 },
		{ kind: "link_offering", count: 973 },
	],
});

export const previewFixture = (
	overrides: Partial<SyncPreviewResponse> = {},
): SyncPreviewResponse => ({
	token: "token-test",
	detail: "Застосується 1 532 зміни.",
	counts: linkCounts,
	skipped_reasons: [],
	waiting_reasons: [],
	run: previewRun,
	...overrides,
});

export const overCapCounts = decisionCounts({
	applied: 5000,
	total: 5000,
	remaining: 19_290,
	by_kind: [{ kind: "link_offering", count: 5000 }],
});

export const overCapPreview = previewFixture({
	counts: overCapCounts,
	detail: "Застосується 5 000 змін.",
});

export const decisionResponse = (
	overrides: Partial<SyncDecisionResponse> = {},
): SyncDecisionResponse => ({
	decision_id: 74,
	action: "apply",
	outcome: "applied",
	detail: "Застосовано 1 532 зміни. Рішення #74.",
	counts: decisionCounts({ applied: 1532, total: 1532 }),
	run: previewRun,
	...overrides,
});

export const rejectedResponse: SyncDecisionResponse = decisionResponse({
	decision_id: 75,
	action: "reject",
	detail: "Відхилено 1 532 зміни. Рішення #75.",
	counts: decisionCounts({ rejected: 1532, total: 1532 }),
});

export const journalApply: SyncJournalEntry = {
	id: 74,
	kind: "apply",
	who: "admin.test",
	when: "2030-09-10T10:00:00Z",
	outcome: "applied",
	error: "",
	counts: { applied: 1855, superseded: 0, waiting: 0 },
	approval_id: 74,
	run_id: 7,
	reverts_id: null,
	group: "change",
	revertible: true,
	revert_reason: "",
	reverted: false,
};

export const journalApplyReverted: SyncJournalEntry = {
	...journalApply,
	revertible: false,
	reverted: true,
};

export const journalRevert: SyncJournalEntry = {
	id: 76,
	kind: "revert",
	who: "admin.test",
	when: "2030-09-10T11:00:00Z",
	outcome: "applied",
	error: "",
	counts: { reverted: 1855, skipped: 0 },
	approval_id: 76,
	run_id: 7,
	reverts_id: 74,
	group: "change",
	revertible: false,
	revert_reason: "",
	reverted: false,
};

export const journalRejected: SyncJournalEntry = {
	id: 75,
	kind: "reject",
	who: "admin.test",
	when: "2030-09-10T10:30:00Z",
	outcome: "applied",
	error: "",
	counts: { rejected: 3, superseded: 0 },
	approval_id: 75,
	run_id: 7,
	reverts_id: null,
	group: "new",
	revertible: false,
	revert_reason: "",
	reverted: false,
};

export const journalAuto: SyncJournalEntry = {
	id: 73,
	kind: "apply",
	who: null,
	when: "2030-09-10T02:31:00Z",
	outcome: "applied",
	error: "",
	counts: { applied: 27_925 },
	approval_id: 73,
	run_id: 7,
	reverts_id: null,
	group: "link",
	revertible: false,
	revert_reason:
		"Цей тип застосовується автоматично. Спершу переведіть його в «Потребує рішення» (правила змінюють у консолі).",
	reverted: false,
};

export const journalPolicy: SyncJournalEntry = {
	id: 5,
	kind: "policy",
	who: "admin.test",
	when: "2030-09-09T12:00:00Z",
	outcome: "changed",
	error: "",
	counts: {
		kind: "link_course",
		old_mode: "needs_approval",
		new_mode: "auto",
	},
	approval_id: null,
	run_id: 7,
	reverts_id: null,
	group: null,
	revertible: false,
	revert_reason: "",
	reverted: false,
};

export const journalAnswer: SyncJournalEntry = {
	id: 6,
	kind: "answer",
	who: "admin.test",
	when: "2030-09-08T12:00:00Z",
	outcome: "merge",
	error: "",
	counts: { kind: "merge_courses", answer: "merge", into: null },
	approval_id: null,
	run_id: 7,
	reverts_id: null,
	group: null,
	revertible: false,
	revert_reason: "",
	reverted: false,
};

export const journalDecisionMerge: SyncJournalEntry = {
	id: 31,
	kind: "decision",
	who: "admin.test",
	when: "2030-09-10T12:00:00Z",
	outcome: "done",
	error: "",
	counts: { action: "merge_course", target_id: "c-101", related_id: "c-102" },
	approval_id: null,
	run_id: 7,
	reverts_id: null,
	group: null,
	revertible: false,
	revert_reason: "",
	reverted: false,
};

export const journalDecisionRefused: SyncJournalEntry = {
	...journalDecisionMerge,
	id: 32,
	outcome: "refused",
	error: "level_mismatch",
	counts: { action: "merge_course", target_id: "c-103", related_id: "c-104" },
};

export const revertDryRun = {
	approval_id: 74,
	decision_id: null,
	dry_run: true,
	outcome: "applied",
	code: null,
	detail: "Відкотило б 1 855 змін.",
	changes: [{ id: 48_121, kind: "change_course" }],
	blockers: [],
	reverted: 1855,
	skipped: 0,
};

export const revertDone = {
	...revertDryRun,
	decision_id: 76,
	dry_run: false,
	detail:
		"Відкочено. Рішення #76. Зміни повернуться в «Чекають рішення» після наступного читання.",
};

export const revertRefused = {
	...revertDryRun,
	outcome: "refused",
	code: "lock_held",
	detail: "Зараз іде нічне читання САЗ. Спробуйте за кілька хвилин.",
	changes: [],
	reverted: 0,
};

export const revertBlocked = {
	approval_id: 74,
	decision_id: null,
	dry_run: true,
	outcome: "refused",
	code: "revert_blocked",
	detail: "Не можна відкотити рішення #74: 2 зміни заважають.",
	changes: [],
	blockers: [
		{
			change_id: 48_121,
			kind: "change_course",
			reason: "changed",
			text: "запис змінився після застосування (назва)",
		},
		{
			change_id: 48_130,
			kind: "change_course",
			reason: "later",
			text: "спершу відкотіть рішення #77 (пізніше застосоване)",
		},
	],
	reverted: 0,
	skipped: 0,
};

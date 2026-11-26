import type { SyncJournalEntry } from "@/lib/api/generated";

export type JournalItem =
	| { kind: "one"; entry: SyncJournalEntry }
	| {
			kind: "batch";
			head: SyncJournalEntry;
			parts: readonly SyncJournalEntry[];
	  };

const PART_GAP_MS = 30 * 60 * 1000;

function continues(newer: SyncJournalEntry, older: SyncJournalEntry): boolean {
	return (
		older.kind === "apply" &&
		newer.kind === "apply" &&
		older.outcome === "applied" &&
		newer.outcome === "applied" &&
		older.who === newer.who &&
		older.group === newer.group &&
		older.run_id === newer.run_id &&
		(older.counts.remaining ?? 0) > 0 &&
		Date.parse(newer.when) - Date.parse(older.when) <= PART_GAP_MS
	);
}

const sum = (
	parts: readonly SyncJournalEntry[],
	key: "applied" | "skipped",
): number => parts.reduce((total, part) => total + (part.counts[key] ?? 0), 0);

function batchHead(parts: readonly SyncJournalEntry[]): SyncJournalEntry {
	const [last] = parts;
	if (last === undefined) {
		throw new Error("A batch has at least one part");
	}
	return {
		...last,
		counts: {
			...last.counts,
			applied: sum(parts, "applied"),
			skipped: sum(parts, "skipped"),
		},
		revertible: false,
		revert_reason: "",
		reverted: parts.every((part) => part.reverted),
	};
}

export function journalItems(
	entries: readonly SyncJournalEntry[],
): JournalItem[] {
	const items: JournalItem[] = [];
	let parts: SyncJournalEntry[] = [];
	const flush = () => {
		const [first] = parts;
		if (parts.length === 1 && first !== undefined) {
			items.push({ kind: "one", entry: first });
		} else if (parts.length > 1) {
			items.push({ kind: "batch", head: batchHead(parts), parts });
		}
		parts = [];
	};
	for (const entry of entries) {
		const newer = parts.at(-1);
		if (newer !== undefined && !continues(newer, entry)) {
			flush();
		}
		parts.push(entry);
	}
	flush();
	return items;
}

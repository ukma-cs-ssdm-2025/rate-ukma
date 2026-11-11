import type { StudentEntry } from "../saz/studentsPage.ts";

/** One offering's decoded students page. */
export interface StudentList {
	readonly snapshotId: bigint;
	readonly sazCode: string;
	readonly entries: ReadonlyArray<StudentEntry>;
}

/** Consecutive lists grouped until a group holds `size` entries. */
export const batchesOf = (
	lists: ReadonlyArray<StudentList>,
	size: number,
): ReadonlyArray<ReadonlyArray<StudentList>> => {
	const batches: Array<Array<StudentList>> = [];
	let entries = size;

	for (const list of lists) {
		if (entries >= size) {
			batches.push([]);
			entries = 0;
		}

		batches.at(-1)?.push(list);
		entries += list.entries.length;
	}

	return batches;
};

/** The rows one batch of lists gives, keyed by САЗ codes and `cdoc`; the
 *  store resolves them to ids. Snapshot ids are strings for `jsonb`. */
export interface StudentRows {
	readonly lists: ReadonlyArray<{
		readonly sazCode: string;
		readonly snapshotId: string;
		readonly entryCount: number;
	}>;
	/** One per programme record, with its person's fields from the latest list
	 *  that names it. `sazCodes` are the batch's lists that name the record,
	 *  so the store can find its programme's level on their cards. */
	readonly programmes: ReadonlyArray<{
		readonly cdoc: string;
		readonly email: string | null;
		readonly fullName: string;
		readonly firstNameKey: string | null;
		readonly specName: string;
		readonly snapshotId: string;
		readonly sazCodes: ReadonlyArray<string>;
	}>;
	readonly enrollments: ReadonlyArray<
		Omit<StudentEntry, "email" | "fullName" | "specName"> & {
			readonly sazCode: string;
		}
	>;
}

/** A name with `*` never replaces one without it (D6). */
export const preferredName = (stored: string | undefined, next: string) =>
	stored !== undefined && next.includes("*") && !stored.includes("*")
		? stored
		: next;

/** The apostrophes САЗ writes, matched as `'` (D7). */
export const APOSTROPHES = "`ʼ’";

/** The first name of a three-word name, lower-cased, with every apostrophe as
 *  `'` (ADR-0013). Null for any other shape or a name with `*`: such a record
 *  cannot be matched with confidence, so it starts a new student (D6). */
export const firstNameKeyOf = (fullName: string): string | null => {
	const words = fullName.split(" ");

	if (words.length !== 3 || fullName.includes("*")) return null;

	return [...(words[1] ?? "").toLowerCase()]
		.map((char) => (APOSTROPHES.includes(char) ? "'" : char))
		.join("");
};

/** The rows of a batch of lists. A record's fields come from the latest list
 *  that names it. `stored` holds the snapshot each stored programme record
 *  was last set from, so an older list cannot take a record back (D1, D7). */
export const studentRowsOf = (
	lists: ReadonlyArray<StudentList>,
	stored: ReadonlyMap<string, bigint>,
): StudentRows => {
	const programmes = new Map<string, StudentRows["programmes"][number]>();
	const byAge = [...lists].sort((a, b) => Number(a.snapshotId - b.snapshotId));
	const emails = new Map<string, string>();

	// The newest email a record shows in the batch; a list without one does
	// not split the person off (D3).
	for (const { entries } of byAge) {
		for (const { cdoc, email } of entries) {
			if (email !== null) emails.set(cdoc, email);
		}
	}

	for (const { snapshotId, sazCode, entries } of byAge) {
		for (const { cdoc, fullName, specName } of entries) {
			if ((stored.get(cdoc) ?? 0n) > snapshotId) continue;

			const previous = programmes.get(cdoc);
			const name = preferredName(previous?.fullName, fullName);

			programmes.set(cdoc, {
				cdoc,
				email: emails.get(cdoc) ?? null,
				fullName: name,
				firstNameKey: firstNameKeyOf(name),
				specName,
				snapshotId: String(snapshotId),
				sazCodes: [...(previous?.sazCodes ?? []), sazCode],
			});
		}
	}

	return {
		lists: lists.map(({ sazCode, snapshotId, entries }) => ({
			sazCode,
			snapshotId: String(snapshotId),
			entryCount: entries.length,
		})),
		programmes: [...programmes.values()],
		enrollments: lists.flatMap(({ sazCode, entries }) =>
			entries.map(
				({ email: _email, fullName: _name, specName: _spec, ...entry }) => ({
					sazCode,
					...entry,
				}),
			),
		),
	};
};

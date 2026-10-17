import type { StudentEntry } from "../saz/studentsPage.ts";

/** One offering's decoded students page. */
export interface StudentList {
	readonly snapshotId: bigint;
	readonly sazCode: string;
	readonly entries: ReadonlyArray<StudentEntry>;
}

/** The rows one batch of lists gives, keyed by САЗ codes, `cdoc` and email;
 *  the store resolves them to ids. Snapshot ids are strings for `jsonb`. */
export interface StudentRows {
	readonly lists: ReadonlyArray<{
		readonly sazCode: string;
		readonly snapshotId: string;
		readonly entryCount: number;
	}>;
	/** A person by email, else by `cdoc` when the entry has no email (D3). */
	readonly students: ReadonlyArray<{
		readonly email: string | null;
		readonly cdoc: string | null;
		readonly fullName: string;
		readonly snapshotId: string;
	}>;
	/** `sazCodes` are the batch's lists that name the record, so the store
	 *  can find its programme's level on their cards. */
	readonly programmes: ReadonlyArray<{
		readonly cdoc: string;
		readonly email: string | null;
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

/** The rows of a batch of lists. A person's fields come from the latest list
 *  that names them. `stored` holds the snapshot each stored programme record
 *  was last set from, so an older list cannot take a record back (D1, D7). */
export const studentRowsOf = (
	lists: ReadonlyArray<StudentList>,
	stored: ReadonlyMap<string, bigint>,
): StudentRows => {
	const programmes = new Map<string, StudentRows["programmes"][number]>();
	const students = new Map<string, StudentRows["students"][number]>();
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

			const email = emails.get(cdoc) ?? null;
			const key = email ?? `cdoc ${cdoc}`;

			programmes.set(cdoc, {
				cdoc,
				email,
				specName,
				snapshotId: String(snapshotId),
				sazCodes: [...(programmes.get(cdoc)?.sazCodes ?? []), sazCode],
			});
			students.set(key, {
				email,
				cdoc: email === null ? cdoc : null,
				fullName: preferredName(students.get(key)?.fullName, fullName),
				snapshotId: String(snapshotId),
			});
		}
	}

	return {
		lists: lists.map(({ sazCode, snapshotId, entries }) => ({
			sazCode,
			snapshotId: String(snapshotId),
			entryCount: entries.length,
		})),
		students: [...students.values()],
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

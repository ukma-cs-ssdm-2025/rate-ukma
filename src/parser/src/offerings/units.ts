/** A faculty or department: САЗ shows its name on the card and lists it in a
 *  catalog filter, whose option value is its id there. */
export interface Unit {
	readonly name: string;
	readonly sazFilterId: string | null;
}

export interface StoredUnit extends Unit {
	readonly id: string;
}

export interface UnitPlan<R extends Unit> {
	/** Stored rows to rewrite with the incoming name and filter id. */
	readonly updates: ReadonlyArray<R & { readonly id: string }>;
	readonly inserts: ReadonlyArray<R>;
}

/** Matches each incoming unit to a stored row by its filter id, else by name,
 *  so a unit САЗ renames keeps its row and gets the new name. A name match
 *  that carries another filter id is a different unit. */
export const planUnits = <R extends Unit>(
	stored: ReadonlyArray<StoredUnit>,
	incoming: ReadonlyArray<R>,
): UnitPlan<R> => {
	const byFilterId = new Map(stored.map((row) => [row.sazFilterId, row]));
	const byName = new Map(stored.map((row) => [row.name, row]));
	const updates: Array<R & { readonly id: string }> = [];
	const inserts: Array<R> = [];

	for (const unit of incoming) {
		const named = byName.get(unit.name);

		const match =
			(unit.sazFilterId === null
				? undefined
				: byFilterId.get(unit.sazFilterId)) ??
			(named !== undefined &&
			(named.sazFilterId === null ||
				unit.sazFilterId === null ||
				named.sazFilterId === unit.sazFilterId)
				? named
				: undefined);

		if (match === undefined) {
			inserts.push(unit);
			continue;
		}

		updates.push({
			...unit,
			id: match.id,
			sazFilterId: unit.sazFilterId ?? match.sazFilterId,
		});
	}

	return { updates, inserts };
};

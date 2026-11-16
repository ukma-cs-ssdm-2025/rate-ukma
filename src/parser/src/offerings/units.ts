/** A faculty or department ("unit"): САЗ shows its name on the card and lists
 *  it in a catalog filter, whose option value is its id there. */
export interface Unit {
	readonly name: string;
	readonly sazFilterId: string | null;
}

export interface StoredUnit extends Unit {
	readonly id: string;
}

export interface UnitPlan<R extends Unit> {
	/** Stored rows that lose their filter id because another row takes it. */
	readonly released: ReadonlyArray<string>;
	/** Stored rows to rewrite with the incoming name and filter id. */
	readonly updates: ReadonlyArray<R & { readonly id: string }>;
	readonly inserts: ReadonlyArray<R>;
}

/** Matches each incoming unit to a stored row: by name first, so the filter
 *  id follows the name when САЗ gives a unit a new option, then by filter id,
 *  so a unit САЗ renames keeps its row. Each stored row matches once, and a
 *  filter id moves to the row that now carries it. A unit without a filter id
 *  keeps its stored one unless another incoming unit carries it, as the new
 *  name of a renamed unit does while older pages still show the old name. */
export const planUnits = <R extends Unit>(
	stored: ReadonlyArray<StoredUnit>,
	incoming: ReadonlyArray<R>,
): UnitPlan<R> => {
	const byName = new Map(stored.map((row) => [row.name, row]));
	const byFilterId = new Map(stored.map((row) => [row.sazFilterId, row]));
	const matches = new Map<R, StoredUnit>();
	const claimed = new Set<string>();

	const claim = (unit: R, row: StoredUnit | undefined) => {
		if (row === undefined || claimed.has(row.id)) return;

		matches.set(unit, row);
		claimed.add(row.id);
	};

	for (const unit of incoming) claim(unit, byName.get(unit.name));

	for (const unit of incoming) {
		if (!matches.has(unit) && unit.sazFilterId !== null) {
			claim(unit, byFilterId.get(unit.sazFilterId));
		}
	}

	const carried = new Set(incoming.map(({ sazFilterId }) => sazFilterId));

	const updates = Array.from(matches, ([unit, row]) => ({
		...unit,
		id: row.id,
		sazFilterId:
			unit.sazFilterId ??
			(carried.has(row.sazFilterId) ? null : row.sazFilterId),
	}));

	const inserts = incoming.filter((unit) => !matches.has(unit));

	const taken = new Set(
		[...updates, ...inserts].map(({ sazFilterId }) => sazFilterId),
	);

	return {
		released: stored.flatMap(({ id, sazFilterId }) =>
			!claimed.has(id) && sazFilterId !== null && taken.has(sazFilterId)
				? [id]
				: [],
		),
		updates,
		inserts,
	};
};

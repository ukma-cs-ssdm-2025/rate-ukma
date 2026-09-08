/**
 * Look up a key in a known-keys map, validating the key at runtime.
 *
 * Keeps the map's literal type (via `satisfies` at the call site) so known
 * keys stay type-safe while unknown input resolves to `undefined`.
 */
export function dictionaryLookup<T extends object>(
	dictionary: T,
	key: string | number,
): T[keyof T] | undefined {
	// SAFETY: Object.hasOwn guards the index against keys the map does not
	// own; anything else (including inherited Object.prototype keys) falls
	// through to the caller's fallback.
	return Object.hasOwn(dictionary, key)
		? dictionary[key as keyof T]
		: undefined;
}

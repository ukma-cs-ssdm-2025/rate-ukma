/**
 * Capability checks for browser-only globals. Use instead of
 * `typeof document === "undefined"` style guards so SSR-safe code parses the
 * environment at its boundary instead of ad hoc `typeof` narrowing.
 * Each check verifies the global holds a usable value, not merely that the
 * property exists.
 */

/** True when the DOM `document` global is available (browser runtime). */
export const hasDocument = (): boolean => globalThis.document !== undefined;

/** True when the browser storage API is available. */
export const hasLocalStorage = (): boolean =>
	globalThis.localStorage !== undefined;

/** True when the browser `window` global is available. */
export const hasWindow = (): boolean => globalThis.window !== undefined;

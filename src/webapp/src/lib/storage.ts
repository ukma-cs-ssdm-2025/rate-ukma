import { hasLocalStorage } from "@/lib/environment";

export interface PersistentStorage {
	getItem<T>(key: string): T | null;
	setItem<T>(key: string, value: T): void;
	removeItem(key: string): void;
}

export class LocalStorageAdapter implements PersistentStorage {
	getItem<T>(key: string): T | null {
		if (!hasLocalStorage()) return null;
		try {
			const rawValue = globalThis.window.localStorage.getItem(key);
			if (rawValue === null) return null;
			// SAFETY: setItem serializes the same T with JSON.stringify, so the
			// stored value round-trips to the generic type this key was written with.
			return JSON.parse(rawValue) as T;
		} catch {
			return null;
		}
	}

	setItem<T>(key: string, value: T): void {
		if (!hasLocalStorage()) return;
		try {
			globalThis.window.localStorage.setItem(key, JSON.stringify(value));
		} catch {
			// Swallow write errors to avoid breaking the UI when storage is unavailable.
		}
	}

	removeItem(key: string): void {
		if (!hasLocalStorage()) return;
		try {
			globalThis.window.localStorage.removeItem(key);
		} catch {
			// Ignore removal errors (e.g., storage disabled).
		}
	}
}

export const localStorageAdapter = new LocalStorageAdapter();

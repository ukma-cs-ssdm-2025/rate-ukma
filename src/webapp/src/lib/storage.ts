export interface PersistentStorage {
	getItem<T>(key: string): T | null;
	setItem<T>(key: string, value: T): void;
	removeItem(key: string): void;
}

// Reading `window.localStorage` itself can throw (SecurityError when the
// browser blocks site data), so every access stays inside a try.
function storage(): Storage | undefined {
	return globalThis.window?.localStorage;
}

export class LocalStorageAdapter implements PersistentStorage {
	getItem<T>(key: string): T | null {
		try {
			const rawValue = storage()?.getItem(key) ?? null;
			if (rawValue === null) return null;
			return JSON.parse(rawValue) as T;
		} catch {
			return null;
		}
	}

	setItem<T>(key: string, value: T): void {
		try {
			storage()?.setItem(key, JSON.stringify(value));
		} catch {
			// Swallow write errors to avoid breaking the UI when storage is unavailable.
		}
	}

	removeItem(key: string): void {
		try {
			storage()?.removeItem(key);
		} catch {
			// Ignore removal errors (e.g., storage disabled).
		}
	}
}

export const localStorageAdapter = new LocalStorageAdapter();

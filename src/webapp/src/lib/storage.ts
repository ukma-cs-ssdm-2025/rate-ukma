export interface PersistentStorage {
	getItem<T>(key: string): T | null;
	setItem<T>(key: string, value: T): void;
	removeItem(key: string): void;
}

function storage(): Storage | undefined {
	return globalThis.window?.localStorage;
}

export class LocalStorageAdapter implements PersistentStorage {
	getItem<T>(key: string): T | null {
		try {
			const rawValue = storage()?.getItem(key) ?? null;
			if (rawValue === null) {
				return null;
			}
			// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- callers read back the shape they wrote; corrupt JSON throws into the catch
			return JSON.parse(rawValue) as T;
		} catch {
			return null;
		}
	}

	setItem<T>(key: string, value: T): void {
		try {
			storage()?.setItem(key, JSON.stringify(value));
		} catch {
			return;
		}
	}

	removeItem(key: string): void {
		try {
			storage()?.removeItem(key);
		} catch {
			return;
		}
	}
}

export const localStorageAdapter = new LocalStorageAdapter();

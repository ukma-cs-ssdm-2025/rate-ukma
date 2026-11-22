import { describe, expect, it } from "vitest";

import type { SyncApproval } from "@/lib/api/generated";
import { catalogGroups } from "./components/syncTestData";
import { bannerFor, previewNote, requestTotal } from "./syncConfirm";
import { openLines } from "./syncGroups";
import {
	clearRequest,
	fieldRequest,
	keepRequest,
	linksRequest,
	mergeDecisionsRequest,
	newRequest,
	pairsRequest,
	placeDecisionsRequest,
} from "./syncRequests";

const practice = catalogGroups.changes.by_field[0];
const blanking = catalogGroups.changes.blanking[0];

describe("confirm requests", () => {
	it("confirms exactly the parts and total the group line shows", () => {
		// Arrange
		const line = openLines(catalogGroups)[0];

		// Act
		const request = linksRequest(catalogGroups);

		// Assert
		expect(requestTotal(request)).toBe(line?.count);
		expect(request.parts).toEqual(line?.parts);
		expect(request.confirmLabel).toBe("Підтвердити 29 457");
		expect(request.approve?.selection).toEqual({ filter: { group: "link" } });
	});

	it("adds new rows without the skipped ones and rejects those", () => {
		// Act
		const request = newRequest(
			"offerings",
			{ group: "new", kind: "new_offering" },
			681,
			[4, 9],
		);

		// Assert
		expect(request.confirmLabel).toBe("Додати 679");
		expect(request.approve?.selection).toEqual({
			filter: { group: "new", kind: "new_offering", exclude_ids: [4, 9] },
		});
		expect(request.reject).toEqual({ change_ids: [4, 9] });
		expect(requestTotal(request)).toBe(681);
	});

	it("approves a field row and keeps or clears a blanking row", () => {
		// Assert
		expect(practice && fieldRequest(practice).approve?.selection).toEqual({
			filter: {
				group: "change",
				changed_field: "practice_type",
				blanks: false,
			},
		});
		expect(blanking && keepRequest(blanking).approve).toBeNull();
		expect(blanking && keepRequest(blanking).reject).toEqual({
			filter: { group: "change", changed_field: "practice_type", blanks: true },
		});
		expect(blanking && clearRequest(blanking).confirmLabel).toBe(
			"Очистити 892",
		);
	});

	it("applies desk decisions and rejects «none of them»", () => {
		// Act
		const merges = mergeDecisionsRequest([1, 2], [3]);
		const places = placeDecisionsRequest([5], [6]);

		// Assert
		expect(merges.approve?.selection).toEqual({ change_ids: [1, 2, 3] });
		expect(requestTotal(merges)).toBe(3);
		expect(places.approve?.selection).toEqual({ change_ids: [5] });
		expect(places.reject).toEqual({ change_ids: [6] });
		expect(placeDecisionsRequest([], [6]).approve).toBeNull();
		expect(pairsRequest(170, 5).approve?.selection).toEqual({
			filter: { group: "mapping", kind: "merge_courses", rated: false },
		});
	});
});

describe("after confirm", () => {
	it("reports what was applied and what still waits", () => {
		// Arrange
		const request = linksRequest(catalogGroups);
		const result: SyncApproval = {
			id: 1,
			action: "apply",
			outcome: "applied",
			counts: { applied: 29_400, waiting: 57 },
			error: "",
		};

		// Act
		const banner = bannerFor(request, [result], 7);

		// Assert
		expect(banner.title).toBe("Готово: підтверджено 29 400");
		expect(banner.detail).toMatch(
			/На сайті нічого не змінилось\. Ще 57 чекають/,
		);
		expect(banner.runId).toBe(7);
	});

	it("says whether the list changed since it was opened", () => {
		// Assert
		expect(previewNote(10, null)).toMatch(/Перевіряємо/);
		expect(previewNote(10, 10)).toMatch(/Список той самий/);
		expect(previewNote(10, 9)).toMatch(/тепер 9 замість 10/);
	});
});

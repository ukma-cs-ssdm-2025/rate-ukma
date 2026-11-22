import { describe, expect, it } from "vitest";

import type { SyncApproval } from "@/lib/api/generated";
import { catalogGroups } from "./components/syncTestData";
import { alsoLines, bannerFor, previewNote, requestTotal } from "./syncConfirm";
import { openLines } from "./syncGroups";
import {
	clearRequest,
	fieldRequest,
	keepRequest,
	linksRequest,
	mergeDecisionsRequest,
	newRequest,
	otherRequest,
	otherSkipRequest,
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

	it("excludes every skipped row however many there are", () => {
		// Arrange
		const skipped = Array.from({ length: 250 }, (_, index) => index + 1);

		// Act
		const request = newRequest(
			"offerings",
			{ group: "new", kind: "new_offering" },
			681,
			skipped,
		);

		// Assert
		expect(request.approve?.selection).toEqual({
			filter: { group: "new", kind: "new_offering", exclude_ids: skipped },
		});
		expect(request.reject).toEqual({ change_ids: skipped });
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

describe("more than 200 decisions", () => {
	it("sends every desk decision and counts exactly the ids sent", () => {
		// Arrange
		const merged = Array.from({ length: 180 }, (_, index) => index + 1);
		const apart = Array.from({ length: 70 }, (_, index) => index + 1001);
		const placed = Array.from({ length: 230 }, (_, index) => index + 2001);
		const none = Array.from({ length: 210 }, (_, index) => index + 3001);

		// Act
		const merges = mergeDecisionsRequest(merged, apart);
		const places = placeDecisionsRequest(placed, none);

		// Assert
		expect(merges.approve?.selection).toEqual({
			change_ids: [...merged, ...apart],
		});
		expect(requestTotal(merges)).toBe(250);
		expect(places.approve?.selection).toEqual({ change_ids: placed });
		expect(places.reject).toEqual({ change_ids: none });
		expect(requestTotal(places)).toBe(440);
	});
});

describe("field rows", () => {
	it("names the other fields the same semesters update or keep", () => {
		// Arrange
		const preview = {
			field_counts: { practice_type: 412, practice_count: 412, credits: 3 },
		};

		// Act
		const update = alsoLines({ name: "practice_type", skip: false }, preview);
		const keep = alsoLines({ name: "practice_type", skip: true }, preview);

		// Assert
		expect(update).toEqual([
			"Також оновиться: кількість практичних — 412",
			"Також оновиться: кредити — 3",
		]);
		expect(keep[0]).toBe("Також залишиться як є: кількість практичних — 412");
		expect(alsoLines({ name: "practice_type", skip: false }, null)).toEqual([]);
	});

	it("describes a field row as whole semesters", () => {
		// Assert
		expect(practice && fieldRequest(practice).field).toEqual({
			name: "practice_type",
			skip: false,
		});
		expect(blanking && keepRequest(blanking).field?.skip).toBe(true);
		expect(blanking && keepRequest(blanking).ticks.join(" ")).toMatch(
			/Інші оновлення в цих семестрах теж буде пропущено/,
		);
	});
});

describe("other changes", () => {
	it("applies or skips the whole other list by filter", () => {
		// Act
		const apply = otherRequest(3);
		const skip = otherSkipRequest(3);

		// Assert
		expect(apply.approve?.selection).toEqual({ filter: { group: "other" } });
		expect(apply.reject).toBeNull();
		expect(skip.approve).toBeNull();
		expect(skip.reject).toEqual({ filter: { group: "other" } });
		expect(requestTotal(apply)).toBe(3);
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

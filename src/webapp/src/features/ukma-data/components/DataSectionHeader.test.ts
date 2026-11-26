import { describe, expect, it } from "vitest";

import { activeTab } from "./DataSectionHeader";

describe("activeTab", () => {
	it("keeps a step review under «Огляд» and the journal under its own tab", () => {
		expect(activeTab("/data")).toBe("/data");
		expect(activeTab("/data/sync/preview")).toBe("/data");
		expect(activeTab("/data/sync")).toBe("/data/sync");
		expect(activeTab("/data/cases/case-1")).toBe("/data/cases");
	});
});

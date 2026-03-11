import { beforeEach, describe, expect, it } from "vitest";

import { lockBodyScroll } from "./body-scroll-lock";

describe("lockBodyScroll", () => {
	beforeEach(() => {
		document.body.style.overflow = "";
		document.body.style.marginRight = "";
	});

	it("locks body scrolling without adding layout compensation margins", () => {
		document.body.style.marginRight = "17px";

		const unlockScroll = lockBodyScroll();

		expect(document.body.style.overflow).toBe("hidden");
		expect(document.body.style.marginRight).toBe("17px");

		unlockScroll();

		expect(document.body.style.overflow).toBe("");
		expect(document.body.style.marginRight).toBe("17px");
	});

	it("restores the previous overflow value after nested locks are released", () => {
		document.body.style.overflow = "clip";

		const unlockFirst = lockBodyScroll();
		const unlockSecond = lockBodyScroll();

		expect(document.body.style.overflow).toBe("hidden");

		unlockSecond();
		expect(document.body.style.overflow).toBe("hidden");

		unlockFirst();
		expect(document.body.style.overflow).toBe("clip");
	});
});

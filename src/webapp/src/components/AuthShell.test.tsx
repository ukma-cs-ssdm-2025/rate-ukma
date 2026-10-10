import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { testIds } from "@/lib/test-ids";
import {
	AuthShell,
	SPOTLIGHT_REST_MS,
	SPOTLIGHT_RESUME_MS,
	SPOTLIGHT_SHOW_MS,
	SPOTLIGHT_START_MS,
} from "./AuthShell";

vi.mock("@/components/ModeToggle", () => ({
	ModeToggle: () => null,
}));

vi.mock("@/components/Logo", () => ({
	Logo: () => null,
}));

// The first courses the carousel shows, in order, and one it reaches much later.
const FIRST_COURSE = "Архітектура обчислювальних систем";
const SECOND_COURSE = "Політична економія";
const HOVERED_COURSE = "Військова соціологія";

const REM_PX = 16;

type Viewport = { width: number; height: number; reducedMotion: boolean };

const WIDE_SCREEN: Viewport = {
	width: 1280,
	height: 720,
	reducedMotion: false,
};

function matchesQuery(query: string, viewport: Viewport) {
	const minWidth = /min-width:\s*([\d.]+)rem/.exec(query);
	const minHeight = /min-height:\s*([\d.]+)rem/.exec(query);
	if (minWidth && viewport.width < Number(minWidth[1]) * REM_PX) {
		return false;
	}
	if (minHeight && viewport.height < Number(minHeight[1]) * REM_PX) {
		return false;
	}
	if (query.includes("prefers-reduced-motion: no-preference")) {
		return !viewport.reducedMotion;
	}
	return true;
}

function renderShell(viewport: Viewport = WIDE_SCREEN) {
	vi.mocked(globalThis.matchMedia).mockImplementation(
		(query: string) =>
			({
				matches: matchesQuery(query, viewport),
				media: query,
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
			}) as unknown as MediaQueryList,
	);
	render(
		<AuthShell>
			<h1>Вхід</h1>
		</AuthShell>,
	);
}

function advance(ms: number) {
	act(() => {
		vi.advanceTimersByTime(ms);
	});
}

function shownCourses() {
	return screen
		.getAllByTestId(testIds.authShell.tooltip)
		.filter((tooltip) => tooltip.dataset.state === "open")
		.map((tooltip) => tooltip.firstChild?.firstChild?.textContent);
}

function dotOf(course: string) {
	const index = screen
		.getAllByTestId(testIds.authShell.tooltip)
		.findIndex((tooltip) => tooltip.textContent?.includes(course));
	return screen.getAllByTestId(testIds.authShell.dot)[index];
}

describe("AuthShell course carousel", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("shows one course at a time with a rest in between", () => {
		renderShell();
		expect(shownCourses()).toEqual([]);

		advance(SPOTLIGHT_START_MS);
		expect(shownCourses()).toEqual([FIRST_COURSE]);

		advance(SPOTLIGHT_SHOW_MS);
		expect(shownCourses()).toEqual([]);

		advance(SPOTLIGHT_REST_MS - 1);
		expect(shownCourses()).toEqual([]);

		advance(1);
		expect(shownCourses()).toEqual([SECOND_COURSE]);
	});

	it("replaces the shown course with the hovered one and holds while hovering", () => {
		renderShell();
		advance(SPOTLIGHT_START_MS);

		fireEvent.mouseEnter(dotOf(HOVERED_COURSE));
		expect(shownCourses()).toEqual([HOVERED_COURSE]);

		for (const step of [
			SPOTLIGHT_SHOW_MS,
			SPOTLIGHT_REST_MS,
			SPOTLIGHT_SHOW_MS,
		]) {
			advance(step);
			expect(shownCourses()).toEqual([HOVERED_COURSE]);
		}
	});

	it("moves on to the next course two seconds after a hover that interrupted a shown one", () => {
		renderShell();
		advance(SPOTLIGHT_START_MS);

		const dot = dotOf(HOVERED_COURSE);
		fireEvent.mouseEnter(dot);
		fireEvent.mouseLeave(dot);
		expect(shownCourses()).toEqual([]);

		advance(SPOTLIGHT_RESUME_MS - 1);
		expect(shownCourses()).toEqual([]);

		advance(1);
		expect(shownCourses()).toEqual([SECOND_COURSE]);
	});

	it("does not skip a course when the hover happens during a rest", () => {
		renderShell();
		advance(SPOTLIGHT_START_MS);
		advance(SPOTLIGHT_SHOW_MS);
		expect(shownCourses()).toEqual([]);

		const dot = dotOf(HOVERED_COURSE);
		fireEvent.mouseEnter(dot);
		expect(shownCourses()).toEqual([HOVERED_COURSE]);

		fireEvent.mouseLeave(dot);
		advance(SPOTLIGHT_RESUME_MS - 1);
		expect(shownCourses()).toEqual([]);

		advance(1);
		expect(shownCourses()).toEqual([SECOND_COURSE]);
	});

	it("carries on from its own dot after that dot was hovered", () => {
		renderShell();
		advance(SPOTLIGHT_START_MS);

		const dot = dotOf(FIRST_COURSE);
		fireEvent.mouseEnter(dot);
		expect(shownCourses()).toEqual([FIRST_COURSE]);

		fireEvent.mouseLeave(dot);
		expect(shownCourses()).toEqual([]);

		advance(SPOTLIGHT_RESUME_MS);
		expect(shownCourses()).toEqual([SECOND_COURSE]);
	});

	it.each([
		["below the width limit", { ...WIDE_SCREEN, width: 1279 }],
		["in a window too short for the tooltips", { ...WIDE_SCREEN, height: 600 }],
		["with reduced motion", { ...WIDE_SCREEN, reducedMotion: true }],
	])("stays off %s", (_, viewport) => {
		renderShell(viewport);

		// One step per call: each timer is only scheduled after the previous one renders.
		for (const step of [
			SPOTLIGHT_START_MS,
			SPOTLIGHT_SHOW_MS,
			SPOTLIGHT_REST_MS,
		]) {
			advance(step);
			expect(shownCourses()).toEqual([]);
		}
	});

	it("still shows a hovered course with reduced motion", () => {
		renderShell({ ...WIDE_SCREEN, reducedMotion: true });

		fireEvent.mouseEnter(dotOf(HOVERED_COURSE));
		expect(shownCourses()).toEqual([HOVERED_COURSE]);
	});
});

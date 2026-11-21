import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";

import { Dialog, DialogContent } from "@/components/ui/Dialog";
import type { RatingSuggestion } from "@/lib/api/generated";
import { render, screen } from "@/test-utils/render";
import { RatingSaved } from "./RatingSaved";

vi.mock("@tanstack/react-router", async () => ({
	...(await vi.importActual("@tanstack/react-router")),
	Link: (await import("@/test-utils/router")).MockLink,
}));

const SUGGESTION = {
	course_id: "c-db",
	course_offering_id: "offering-c-db",
	course_title: "Бази даних",
	semester: { year: 2026, season: "SPRING" },
	ratings_count: 0,
} as RatingSuggestion;

function renderSaved(
	suggestions: RatingSuggestion[],
	isError = false,
	openCourse?: { courseId: string; name?: string; onOpen: () => void },
) {
	const onClose = vi.fn();
	const onSelect = vi.fn();
	render(
		<Dialog open>
			<DialogContent>
				<RatingSaved
					suggestions={suggestions}
					isLoading={false}
					isError={isError}
					onSelect={onSelect}
					onClose={onClose}
					openCourse={openCourse}
				/>
			</DialogContent>
		</Dialog>,
	);
	return { onClose, onSelect };
}

describe("RatingSaved", () => {
	it("offers the next rating and a way to stop", async () => {
		const { onClose, onSelect } = renderSaved([SUGGESTION]);
		await userEvent.click(
			screen.getByRole("button", { name: "Оцінити «Бази даних»" }),
		);
		expect(onSelect).toHaveBeenCalledWith(SUGGESTION);
		await userEvent.click(screen.getByRole("button", { name: "Не зараз" }));
		expect(onClose).toHaveBeenCalled();
	});

	it.each([false, true])(
		"closes with «Готово» when nothing is offered (error: %s)",
		async (isError) => {
			const { onClose } = renderSaved([], isError);
			expect(screen.queryByRole("button", { name: /^Оцінити/ })).toBeNull();
			await userEvent.click(screen.getByRole("button", { name: "Готово" }));
			expect(onClose).toHaveBeenCalled();
		},
	);

	it("offers the rated course only when asked to", async () => {
		renderSaved([SUGGESTION]);
		expect(screen.queryByRole("link", { name: /^Відкрити/ })).toBeNull();
	});

	it.each([
		[[SUGGESTION], "Алгоритми", "Відкрити «Алгоритми»"],
		[[], undefined, "Відкрити дисципліну"],
	])(
		"opens the rated course next to the way out (%#)",
		async (suggestions, name, label) => {
			const onOpen = vi.fn();
			renderSaved(suggestions, false, { courseId: "c-asd", name, onOpen });
			const link = screen.getByRole("link", { name: label });
			expect(link.getAttribute("href")).toBe("/courses/$courseId");
			await userEvent.click(link);
			expect(onOpen).toHaveBeenCalled();
			expect(
				screen.getByRole("button", {
					name: suggestions.length ? "Не зараз" : "Готово",
				}),
			).toBeTruthy();
		},
	);
});

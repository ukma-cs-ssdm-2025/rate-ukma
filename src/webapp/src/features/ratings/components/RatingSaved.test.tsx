import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";

import { Dialog, DialogContent } from "@/components/ui/Dialog";
import type { RatingSuggestion } from "@/lib/api/generated";
import { render, screen } from "@/test-utils/render";
import { RatingSaved } from "./RatingSaved";

const SUGGESTION = {
	course_id: "c-db",
	course_offering_id: "offering-c-db",
	course_title: "Бази даних",
	semester: { year: 2026, season: "SPRING" },
	ratings_count: 0,
} as RatingSuggestion;

function renderSaved(suggestions: RatingSuggestion[], isError = false) {
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
});

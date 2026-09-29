import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/Tooltip";
import { RatingVotes } from "./RatingVotes";

const createVote = vi.hoisted(() => vi.fn());

vi.mock("../hooks/useVoteMutations", () => ({
	useCoursesRatingsVotesCreate: () => ({ mutateAsync: createVote }),
	useCoursesRatingsVotesDestroy: () => ({ mutateAsync: vi.fn() }),
}));

function renderVotes(disabledReason?: string) {
	render(
		<QueryClientProvider client={new QueryClient()}>
			<TooltipProvider>
				<RatingVotes
					ratingId="rating-1"
					initialUpvotes={2}
					disabledReason={disabledReason}
				/>
			</TooltipProvider>
		</QueryClientProvider>,
	);
}

describe("RatingVotes", () => {
	beforeEach(() => {
		createVote.mockReset().mockResolvedValue({});
	});

	it("sends the vote when voting is allowed", async () => {
		renderVotes();

		await userEvent.click(screen.getByRole("button", { name: "За: 2" }));

		expect(screen.getByRole("button", { name: "За: 3" })).toHaveAttribute(
			"aria-pressed",
			"true",
		);
		await waitFor(() =>
			expect(createVote).toHaveBeenCalledWith({
				ratingId: "rating-1",
				data: { vote_type: "UPVOTE" },
			}),
		);
	});

	it("explains instead of voting when the viewer cannot vote", async () => {
		renderVotes("Спершу прослухайте курс");

		await userEvent.click(screen.getByRole("button", { name: "За: 2" }));

		expect(await screen.findByRole("tooltip")).toHaveTextContent(
			"Спершу прослухайте курс",
		);
		const upvote = screen.getByRole("button", { name: "За: 2" });
		expect(upvote).toHaveAttribute("aria-disabled", "true");
		expect(upvote).toHaveAttribute("aria-pressed", "false");
	});
});

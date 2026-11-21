import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/Tooltip";
import { RatingVotes } from "./RatingVotes";

const createVote = vi.hoisted(() => vi.fn());
const deleteVote = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/generated", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/api/generated")>()),
	useRatingsVotesUpdate: () => ({ mutateAsync: createVote }),
	useRatingsVotesDestroy: () => ({ mutateAsync: deleteVote }),
}));

vi.mock("@/components/ui/Toaster", () => ({
	toast: { error: toastError },
}));

function renderVotes(disabledReason?: string) {
	return render(
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

const UPVOTE = { ratingId: "rating-1", data: { vote_type: "UPVOTE" } };

function deferred() {
	let resolve: (value: unknown) => void = () => undefined;
	let reject: (reason: unknown) => void = () => undefined;
	const promise = new Promise((done, fail) => {
		resolve = done;
		reject = fail;
	});
	return { promise, resolve, reject };
}

describe("RatingVotes", () => {
	beforeEach(() => {
		createVote.mockReset().mockResolvedValue({});
		deleteVote.mockReset().mockResolvedValue({});
		toastError.mockReset();
		vi.spyOn(console, "error").mockImplementation(() => undefined);
	});

	it("sends the vote at once when voting is allowed", async () => {
		renderVotes();

		await userEvent.click(screen.getByRole("button", { name: "За: 2" }));

		expect(screen.getByRole("button", { name: "За: 3" })).toHaveAttribute(
			"aria-pressed",
			"true",
		);
		expect(createVote).toHaveBeenCalledWith(UPVOTE);
	});

	it("still sends the vote when the card unmounts right after the click", async () => {
		const view = renderVotes();

		await userEvent.click(screen.getByRole("button", { name: "За: 2" }));
		view.unmount();

		expect(createVote).toHaveBeenCalledWith(UPVOTE);
	});

	it("sends vote, unvote and vote again one after another, ending on the last click", async () => {
		const firstVote = deferred();
		const unvote = deferred();
		createVote.mockReturnValueOnce(firstVote.promise);
		deleteVote.mockReturnValueOnce(unvote.promise);
		renderVotes();

		await userEvent.click(screen.getByRole("button", { name: "За: 2" }));
		await userEvent.click(screen.getByRole("button", { name: "За: 3" }));
		expect(deleteVote).not.toHaveBeenCalled();

		firstVote.resolve({});
		await waitFor(() => expect(deleteVote).toHaveBeenCalledOnce());

		await userEvent.click(screen.getByRole("button", { name: "За: 2" }));
		expect(createVote).toHaveBeenCalledOnce();

		unvote.resolve({});
		await waitFor(() => expect(createVote).toHaveBeenCalledTimes(2));

		const [firstCreate, lastCreate] = createVote.mock.invocationCallOrder;
		const [onlyDelete] = deleteVote.mock.invocationCallOrder;
		expect(firstCreate).toBeLessThan(onlyDelete);
		expect(onlyDelete).toBeLessThan(lastCreate);
		expect(createVote).toHaveBeenLastCalledWith(UPVOTE);
		expect(screen.getByRole("button", { name: "За: 3" })).toHaveAttribute(
			"aria-pressed",
			"true",
		);
	});

	it("sends a click queued behind a pending vote even after unmount", async () => {
		const firstVote = deferred();
		createVote.mockReturnValueOnce(firstVote.promise);
		const view = renderVotes();

		await userEvent.click(screen.getByRole("button", { name: "За: 2" }));
		await userEvent.click(screen.getByRole("button", { name: "За: 3" }));
		view.unmount();

		firstVote.resolve({});

		await waitFor(() =>
			expect(deleteVote).toHaveBeenCalledWith({ ratingId: "rating-1" }),
		);
	});

	it("puts the count back and says so when the vote fails", async () => {
		createVote.mockRejectedValueOnce(new Error("offline"));
		renderVotes();

		await userEvent.click(screen.getByRole("button", { name: "За: 2" }));

		await waitFor(() =>
			expect(screen.getByRole("button", { name: "За: 2" })).toHaveAttribute(
				"aria-pressed",
				"false",
			),
		);
		expect(toastError).toHaveBeenCalledWith(
			"Не вдалося зберегти ваш голос. Спробуйте ще раз",
		);
	});

	it("keeps the saved vote when a queued unvote fails", async () => {
		const firstVote = deferred();
		createVote.mockReturnValueOnce(firstVote.promise);
		deleteVote.mockRejectedValueOnce(new Error("offline"));
		renderVotes();

		await userEvent.click(screen.getByRole("button", { name: "За: 2" }));
		await userEvent.click(screen.getByRole("button", { name: "За: 3" }));
		firstVote.resolve({});

		await waitFor(() => expect(toastError).toHaveBeenCalledOnce());
		expect(deleteVote).toHaveBeenCalledOnce();
		expect(screen.getByRole("button", { name: "За: 3" })).toHaveAttribute(
			"aria-pressed",
			"true",
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
		expect(createVote).not.toHaveBeenCalled();
	});
});

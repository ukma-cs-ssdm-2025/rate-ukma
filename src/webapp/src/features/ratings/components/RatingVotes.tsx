import { useEffect, useState } from "react";

import { ArrowBigDown, ArrowBigUp } from "lucide-react";

import { Button } from "@/components/ui/Button";
import type { RatingVoteCreateSchema } from "@/lib/api/generated";
import { cn } from "@/lib/utils";
import {
	useCoursesRatingsVotesCreate,
	useCoursesRatingsVotesDestroy,
} from "../hooks/useVoteMutations";

interface RatingVotesProps {
	ratingId: string;
	initialUpvotes?: number;
	initialDownvotes?: number;
	initialUserVote?: "UPVOTE" | "DOWNVOTE" | null;
	readOnly?: boolean;
}

export function RatingVotes({
	ratingId,
	initialUpvotes = 0,
	initialDownvotes = 0,
	initialUserVote = null,
	readOnly = false,
}: RatingVotesProps) {
	// The "optimistic" vote state - updates immediately on click
	const [userVote, setUserVote] = useState<"UPVOTE" | "DOWNVOTE" | null>(
		initialUserVote,
	);
	// The "authority" vote state - what is actually on the server
	const [serverVote, setServerVote] = useState<"UPVOTE" | "DOWNVOTE" | null>(
		initialUserVote,
	);

	const createVote = useCoursesRatingsVotesCreate();
	const deleteVote = useCoursesRatingsVotesDestroy();

	// Derived counts based on initial props and optimistic userVote
	const upvotes =
		initialUpvotes +
		(initialUserVote === "UPVOTE" ? -1 : 0) +
		(userVote === "UPVOTE" ? 1 : 0);
	const downvotes =
		initialDownvotes +
		(initialUserVote === "DOWNVOTE" ? -1 : 0) +
		(userVote === "DOWNVOTE" ? 1 : 0);

	// Sync local state with props if they change (e.g. after a re-fetch from elsewhere)
	useEffect(() => {
		setUserVote(initialUserVote);
		setServerVote(initialUserVote);
	}, [initialUserVote]);

	// Debounced sync effect
	useEffect(() => {
		if (userVote === serverVote) return;

		const timer = setTimeout(async () => {
			try {
				if (userVote === null) {
					await deleteVote.mutateAsync({ ratingId });
				} else {
					const voteData: RatingVoteCreateSchema = {
						vote_type: userVote,
						rating_id: ratingId,
						student_id: "", // Backend overwrites this
					};
					await createVote.mutateAsync({
						ratingId,
						data: voteData,
					});
				}
				// Sync authority state on success
				setServerVote(userVote);
			} catch (error) {
				console.error("Failed to sync vote with server:", error);
				// Revert optimistic state on error
				setUserVote(serverVote);
			}
		}, 500); // 500ms debounce

		return () => clearTimeout(timer);
	}, [userVote, serverVote, ratingId, createVote, deleteVote]);

	const handleUpvote = () => {
		if (readOnly) return;
		setUserVote((prev) => (prev === "UPVOTE" ? null : "UPVOTE"));
	};

	const handleDownvote = () => {
		if (readOnly) return;
		setUserVote((prev) => (prev === "DOWNVOTE" ? null : "DOWNVOTE"));
	};

	if (readOnly) {
		return (
			<div className="flex items-center gap-4 mt-3 justify-end">
				<div className="flex items-center gap-1.5 transition-colors">
					<ArrowBigUp
						className={cn(
							"h-5 w-5",
							userVote === "UPVOTE"
								? "fill-current text-[#0076BB]"
								: "text-muted-foreground/40",
						)}
					/>
					<span
						className={cn(
							"text-xs font-bold",
							userVote === "UPVOTE"
								? "text-[#0076BB]"
								: "text-muted-foreground",
						)}
					>
						{upvotes}
					</span>
				</div>
				<div className="flex items-center gap-1.5 transition-colors">
					<ArrowBigDown
						className={cn(
							"h-5 w-5",
							userVote === "DOWNVOTE"
								? "fill-current text-[#0076BB]"
								: "text-muted-foreground/40",
						)}
					/>
					<span
						className={cn(
							"text-xs font-bold",
							userVote === "DOWNVOTE"
								? "text-[#0076BB]"
								: "text-muted-foreground",
						)}
					>
						{downvotes}
					</span>
				</div>
			</div>
		);
	}

	return (
		<div className="flex items-center gap-1 mt-3 justify-end">
			<Button
				variant="ghost"
				size="sm"
				onClick={handleUpvote}
				className={cn(
					"h-8 px-2 gap-1.5 transition-all duration-200",
					"hover:bg-[#0076BB]/10 hover:text-[#0076BB]",
					userVote === "UPVOTE"
						? "text-[#0076BB] bg-[#0076BB]/10 ring-1 ring-inset ring-[#0076BB]/20"
						: "text-muted-foreground",
				)}
				aria-label="За"
			>
				<ArrowBigUp
					className={cn("h-5 w-5", userVote === "UPVOTE" && "fill-current")}
				/>
				<span className="text-xs font-bold">{upvotes}</span>
			</Button>

			<Button
				variant="ghost"
				size="sm"
				onClick={handleDownvote}
				className={cn(
					"h-8 px-2 gap-1.5 transition-all duration-200",
					"hover:bg-[#0076BB]/10 hover:text-[#0076BB]",
					userVote === "DOWNVOTE"
						? "text-[#0076BB] bg-[#0076BB]/10 ring-1 ring-inset ring-[#0076BB]/20"
						: "text-muted-foreground",
				)}
				aria-label="Проти"
			>
				<ArrowBigDown
					className={cn("h-5 w-5", userVote === "DOWNVOTE" && "fill-current")}
				/>
				<span className="text-xs font-bold">{downvotes}</span>
			</Button>
		</div>
	);
}

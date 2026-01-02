import { useEffect, useRef, useState } from "react";

import { ArrowBigDown, ArrowBigUp } from "lucide-react";

import { Button } from "@/components/ui/Button";
import type { RatingVoteCreateRequest } from "@/lib/api/generated";
import { cn } from "@/lib/utils";
import {
	useCoursesRatingsVotesCreate,
	useCoursesRatingsVotesDestroy,
} from "../hooks/useVoteMutations";

type VoteType = "UPVOTE" | "DOWNVOTE";

interface RatingVotesProps {
	ratingId: string;
	initialUpvotes?: number;
	initialDownvotes?: number;
	initialUserVote?: VoteType | null;
	readOnly?: boolean;
}

interface VoteProps {
	readonly type: VoteType;
	readonly count: number;
	readonly active: boolean;
	readonly onClick?: () => void;
	readonly asButton?: boolean;
}

function Vote({
	type,
	count,
	active,
	onClick,
	asButton = false,
}: Readonly<VoteProps>) {
	const Icon = type === "UPVOTE" ? ArrowBigUp : ArrowBigDown;
	if (asButton) {
		return (
			<Button
				variant="ghost"
				size="sm"
				onClick={onClick}
				className={cn(
					"h-8 px-2 gap-1.5 transition-all duration-200",
					"hover:bg-[#0076BB]/10 hover:text-[#0076BB]",
					active
						? "text-[#0076BB] bg-[#0076BB]/10 ring-1 ring-inset ring-[#0076BB]/20"
						: "text-muted-foreground",
				)}
				aria-label={type === "UPVOTE" ? "За" : "Проти"}
			>
				<Icon className={cn("h-5 w-5", active && "fill-current")} />
				<span className="text-xs font-bold">{count}</span>
			</Button>
		);
	}

	return (
		<div className="flex items-center gap-1.5 h-8 px-2 transition-colors">
			<Icon
				className={cn(
					"h-5 w-5",
					active ? "fill-current text-[#0076BB]" : "text-muted-foreground/40",
				)}
			/>
			<span
				className={cn(
					"text-xs font-bold",
					active ? "text-[#0076BB]" : "text-muted-foreground",
				)}
			>
				{count}
			</span>
		</div>
	);
}

export function RatingVotes({
	ratingId,
	initialUpvotes = 0,
	initialDownvotes = 0,
	initialUserVote = null,
	readOnly = false,
}: Readonly<RatingVotesProps>) {
	// The "optimistic" vote state - updates immediately on click
	const [userVote, setUserVote] = useState<VoteType | null>(initialUserVote);
	// The "authority" vote state - what is actually on the server
	const [serverVote, setServerVote] = useState<VoteType | null>(
		initialUserVote,
	);

	const createVote = useCoursesRatingsVotesCreate();
	const deleteVote = useCoursesRatingsVotesDestroy();

	// Store stable references to mutation functions
	const createVoteRef = useRef(createVote.mutateAsync);
	const deleteVoteRef = useRef(deleteVote.mutateAsync);

	// Keep refs updated
	useEffect(() => {
		createVoteRef.current = createVote.mutateAsync;
		deleteVoteRef.current = deleteVote.mutateAsync;
	}, [createVote.mutateAsync, deleteVote.mutateAsync]);

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

		let isMounted = true;

		const timer = setTimeout(async () => {
			try {
				if (userVote === null) {
					await deleteVoteRef.current({ ratingId });
				} else {
					const voteData: RatingVoteCreateRequest = {
						vote_type: userVote,
					};
					await createVoteRef.current({
						ratingId,
						data: voteData,
					});
				}
				// Sync authority state on success only if still mounted
				if (isMounted) {
					setServerVote(userVote);
				}
			} catch (error) {
				// Only handle error if still mounted
				if (isMounted) {
					console.error("Failed to sync vote with server:", error);
					// Revert optimistic state on error
					setUserVote(serverVote);
				}
			}
		}, 500); // 500ms debounce

		return () => {
			clearTimeout(timer);
			isMounted = false;
		};
	}, [userVote, serverVote, ratingId]);

	const toggleVote = (target: VoteType) => {
		if (readOnly) return;
		setUserVote((prev) => (prev === target ? null : target));
	};

	const upActive = userVote === "UPVOTE";
	const downActive = userVote === "DOWNVOTE";

	if (readOnly) {
		return (
			<div className="flex items-center gap-1 mt-3 justify-end">
				<Vote type="UPVOTE" count={upvotes} active={upActive} />
				<Vote type="DOWNVOTE" count={downvotes} active={downActive} />
			</div>
		);
	}

	return (
		<div className="flex items-center gap-1 mt-3 justify-end">
			<Vote
				type="UPVOTE"
				count={upvotes}
				active={upActive}
				onClick={() => toggleVote("UPVOTE")}
				asButton
			/>

			<Vote
				type="DOWNVOTE"
				count={downvotes}
				active={downActive}
				onClick={() => toggleVote("DOWNVOTE")}
				asButton
			/>
		</div>
	);
}

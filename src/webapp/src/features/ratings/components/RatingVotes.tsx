import { useEffect, useRef, useState } from "react";

import { ArrowBigDown, ArrowBigUp } from "lucide-react";
import { useDebouncedCallback } from "use-debounce";

import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toaster";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/Tooltip";
import { RatingVoteStrType } from "@/lib/api/generated";
import { cn } from "@/lib/utils";
import {
	useCoursesRatingsVotesCreate,
	useCoursesRatingsVotesDestroy,
} from "../hooks/useVoteMutations";

/**
 * RatingVotes - Optimistic Updates with Cache Synchronization
 *
 * This component uses fully optimistic updates with React Query cache updates.
 * Vote state is maintained independently per rating and never overwritten by props.
 *
 * Key mechanisms:
 * 1. Initial State Lock: Props are only used on mount/ratingId change
 * 2. Cache Updates: React Query cache is updated on vote success
 * 3. Request Sequence: Ignores out-of-order API responses
 * 4. Sort Key Flushing: Syncs pending votes on filter/sort changes
 *
 * How it works:
 * - Vote on Rating A → Updates local state + React Query cache
 * - Change filter to "popularity" → Fresh fetch, cache has updated vote
 * - Change filter back → Cache returns updated data with your vote ✓
 * - No refetches needed, no stale data issues
 */

interface RatingVotesProps {
	ratingId: string;
	initialUpvotes?: number;
	initialDownvotes?: number;
	initialUserVote?: RatingVoteStrType | null;
	readOnly?: boolean;
	disabledMessage?: string;
	sortKey?: string;
}

interface VoteProps {
	readonly isUpvote: boolean;
	readonly count: number;
	readonly active: boolean;
	readonly onClick?: () => void;
	readonly asButton?: boolean;
}

function Vote({
	isUpvote,
	count,
	active,
	onClick,
	asButton = false,
}: Readonly<VoteProps>) {
	const Icon = isUpvote ? ArrowBigUp : ArrowBigDown;
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
				aria-label={isUpvote ? "За" : "Проти"}
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
	disabledMessage,
	sortKey,
}: Readonly<RatingVotesProps>) {
	// Store initial values - these are the source of truth from server on mount
	const initialValuesRef = useRef({
		ratingId,
		upvotes: initialUpvotes,
		downvotes: initialDownvotes,
		userVote: initialUserVote,
	});

	// The "optimistic" vote state - updates immediately on click
	const [userVote, setUserVote] = useState<RatingVoteStrType | null>(
		initialUserVote,
	);
	// The "authority" vote state - what is actually on the server
	const [serverVote, setServerVote] = useState<RatingVoteStrType | null>(
		initialUserVote,
	);

	const createVote = useCoursesRatingsVotesCreate();
	const deleteVote = useCoursesRatingsVotesDestroy();

	// Store stable references
	const previousSortKeyRef = useRef(sortKey);
	const isMountedRef = useRef(true);
	// Track request sequence to ignore out-of-order responses
	const requestSequenceRef = useRef(0);
	const lastCompletedSequenceRef = useRef(0);

	// Track component mount status and reset state when ratingId changes
	useEffect(() => {
		isMountedRef.current = true;

		// Reset state when viewing a different rating
		if (initialValuesRef.current.ratingId !== ratingId) {
			initialValuesRef.current = {
				ratingId,
				upvotes: initialUpvotes,
				downvotes: initialDownvotes,
				userVote: initialUserVote,
			};
			setUserVote(initialUserVote);
			setServerVote(initialUserVote);
			requestSequenceRef.current = 0;
			lastCompletedSequenceRef.current = 0;
		}

		return () => {
			isMountedRef.current = false;
		};
	}, [ratingId, initialUpvotes, initialDownvotes, initialUserVote]);

	// Debounced function to sync votes with server
	const debouncedSyncVote = useDebouncedCallback(
		async (voteToSync: RatingVoteStrType | null) => {
			if (!isMountedRef.current) return;

			// Assign a sequence number to this request
			const currentSequence = ++requestSequenceRef.current;

			try {
				if (voteToSync === null) {
					await deleteVote.mutateAsync({ ratingId });
				} else {
					await createVote.mutateAsync({
						ratingId,
						data: { vote_type: voteToSync },
					});
				}

				// Only update state if this is still the latest request
				if (
					isMountedRef.current &&
					currentSequence >= lastCompletedSequenceRef.current
				) {
					lastCompletedSequenceRef.current = currentSequence;
					setServerVote(voteToSync);
				}
				// Note: Cache is updated automatically by mutation's onSuccess
			} catch (error) {
				// Only rollback if this is the latest request
				if (
					isMountedRef.current &&
					currentSequence >= lastCompletedSequenceRef.current
				) {
					console.error("Failed to sync vote with server:", error);
					toast.error("Не вдалося зберегти ваш голос. Спробуйте ще раз");
					setUserVote(serverVote);
				}
			}
		},
		500, // 500ms debounce
	);

	// Trigger debounced sync when userVote changes
	// NOTE: This effect must run before the sortKey flush effect below
	// to ensure flush() always has a scheduled debounce to execute
	useEffect(() => {
		if (userVote !== serverVote) {
			debouncedSyncVote(userVote);
		}
	}, [userVote, serverVote, debouncedSyncVote]);

	// Flush pending votes immediately when sort changes
	useEffect(() => {
		if (sortKey === previousSortKeyRef.current) {
			return;
		}

		previousSortKeyRef.current = sortKey;

		// If there's a pending vote, flush it immediately
		if (userVote !== serverVote) {
			debouncedSyncVote.flush();
		}
	}, [sortKey, userVote, serverVote, debouncedSyncVote]);

	// Derived counts based on initial values and optimistic userVote
	// Use initial values from mount, not current props (which may be stale cached data)
	const {
		upvotes: baseUpvotes,
		downvotes: baseDownvotes,
		userVote: baseUserVote,
	} = initialValuesRef.current;
	const upvotes =
		baseUpvotes +
		(baseUserVote === RatingVoteStrType.UPVOTE ? -1 : 0) +
		(userVote === RatingVoteStrType.UPVOTE ? 1 : 0);
	const downvotes =
		baseDownvotes +
		(baseUserVote === RatingVoteStrType.DOWNVOTE ? -1 : 0) +
		(userVote === RatingVoteStrType.DOWNVOTE ? 1 : 0);

	// Flush pending votes on unmount to avoid losing user input
	useEffect(() => {
		return () => {
			debouncedSyncVote.flush();
		};
	}, [debouncedSyncVote]);

	const toggleVote = (target: RatingVoteStrType) => {
		if (readOnly) return;
		setUserVote((prev) => (prev === target ? null : target));
	};

	const upActive = userVote === RatingVoteStrType.UPVOTE;
	const downActive = userVote === RatingVoteStrType.DOWNVOTE;

	if (readOnly) {
		if (disabledMessage) {
			return (
				<div className="flex items-center gap-1 mt-3 justify-end">
					<Tooltip delayDuration={0}>
						<TooltipTrigger>
							<Vote isUpvote count={upvotes} active={upActive} />
						</TooltipTrigger>
						<TooltipContent side="top" sideOffset={4}>
							<p>{disabledMessage}</p>
						</TooltipContent>
					</Tooltip>
					<Tooltip delayDuration={0}>
						<TooltipTrigger>
							<Vote isUpvote={false} count={downvotes} active={downActive} />
						</TooltipTrigger>
						<TooltipContent side="top" sideOffset={4}>
							<p>{disabledMessage}</p>
						</TooltipContent>
					</Tooltip>
				</div>
			);
		}
		return (
			<div className="flex items-center gap-1 mt-3 justify-end">
				<Vote isUpvote count={upvotes} active={upActive} />
				<Vote isUpvote={false} count={downvotes} active={downActive} />
			</div>
		);
	}

	return (
		<div className="flex items-center gap-1 mt-3 justify-end">
			<Vote
				isUpvote
				count={upvotes}
				active={upActive}
				onClick={() => toggleVote(RatingVoteStrType.UPVOTE)}
				asButton
			/>

			<Vote
				isUpvote={false}
				count={downvotes}
				active={downActive}
				onClick={() => toggleVote(RatingVoteStrType.DOWNVOTE)}
				asButton
			/>
		</div>
	);
}

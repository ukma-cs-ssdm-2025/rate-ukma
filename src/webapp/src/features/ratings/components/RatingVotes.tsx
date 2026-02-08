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
	// The "optimistic" vote state - updates immediately on click
	const [userVote, setUserVote] = useState<RatingVoteStrType | null>(
		initialUserVote,
	);
	// The "authority" vote state - what is actually on the server
	const [serverVote, setServerVote] = useState<RatingVoteStrType | null>(
		initialUserVote,
	);
	// Track when we last updated the server to ignore stale props
	const [lastServerUpdateTime, setLastServerUpdateTime] = useState<number>(0);

	const createVote = useCoursesRatingsVotesCreate();
	const deleteVote = useCoursesRatingsVotesDestroy();

	// Store stable references
	const previousSortKeyRef = useRef(sortKey);
	const isMountedRef = useRef(true);

	// Track component mount status
	useEffect(() => {
		isMountedRef.current = true;
		return () => {
			isMountedRef.current = false;
		};
	}, []);

	// Debounced function to sync votes with server
	const debouncedSyncVote = useDebouncedCallback(
		async (voteToSync: RatingVoteStrType | null) => {
			if (!isMountedRef.current) return;

			try {
				if (voteToSync === null) {
					await deleteVote.mutateAsync({ ratingId });
				} else {
					await createVote.mutateAsync({
						ratingId,
						data: { vote_type: voteToSync },
					});
				}
				if (isMountedRef.current) {
					setServerVote(voteToSync);
					setLastServerUpdateTime(Date.now());
				}
			} catch (error) {
				if (isMountedRef.current) {
					console.error("Failed to sync vote with server:", error);
					toast.error("Не вдалося зберегти ваш голос. Спробуйте ще раз");
					setUserVote(serverVote);
				}
			}
		},
		500, // 500ms debounce
	);

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

	// Derived counts based on initial props and optimistic userVote
	const upvotes =
		initialUpvotes +
		(initialUserVote === RatingVoteStrType.UPVOTE ? -1 : 0) +
		(userVote === RatingVoteStrType.UPVOTE ? 1 : 0);
	const downvotes =
		initialDownvotes +
		(initialUserVote === RatingVoteStrType.DOWNVOTE ? -1 : 0) +
		(userVote === RatingVoteStrType.DOWNVOTE ? 1 : 0);

	// Sync local state with props only when there's no pending operation
	// This prevents stale cached data from overwriting in-flight votes
	useEffect(() => {
		const hasPendingOperation = userVote !== serverVote;
		const timeSinceLastUpdate = Date.now() - lastServerUpdateTime;
		const inGracePeriod = timeSinceLastUpdate < 2000; // 2 second grace period

		// Ignore prop updates during pending operations
		if (hasPendingOperation) {
			return;
		}

		// If in grace period, schedule a re-check after the remaining time
		if (inGracePeriod) {
			const remaining = 2000 - timeSinceLastUpdate;
			const graceTimer = setTimeout(() => {
				// Re-check sync after grace period expires
				if (initialUserVote !== serverVote) {
					setUserVote(initialUserVote);
					setServerVote(initialUserVote);
				}
			}, remaining);

			return () => {
				clearTimeout(graceTimer);
			};
		}

		// No pending operation and grace period expired - sync with props if they changed
		if (initialUserVote !== serverVote) {
			setUserVote(initialUserVote);
			setServerVote(initialUserVote);
		}
	}, [initialUserVote, userVote, serverVote, lastServerUpdateTime]);

	// Trigger debounced sync when userVote changes
	useEffect(() => {
		if (userVote !== serverVote) {
			debouncedSyncVote(userVote);
		}
	}, [userVote, serverVote, debouncedSyncVote]);

	// Cancel pending debounced calls on unmount
	useEffect(() => {
		return () => {
			debouncedSyncVote.cancel();
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

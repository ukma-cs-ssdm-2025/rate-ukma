import { useEffect, useRef, useState } from "react";

import { useQueryClient } from "@tanstack/react-query";
import { ArrowBigDown, ArrowBigUp } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toaster";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/Tooltip";
import {
	getCoursesRatingsListQueryKey,
	RatingVoteStrType,
} from "@/lib/api/generated";
import { cn } from "@/lib/utils";
import {
	useCoursesRatingsVotesCreate,
	useCoursesRatingsVotesDestroy,
} from "../hooks/useVoteMutations";

interface RatingVotesProps {
	ratingId: string;
	courseId?: string;
	initialUpvotes?: number;
	initialDownvotes?: number;
	initialUserVote?: RatingVoteStrType | null;
	readOnly?: boolean;
	disabledMessage?: string;
	inline?: boolean;
}

interface VoteProps {
	readonly isUpvote: boolean;
	readonly count: number;
	readonly active: boolean;
	readonly disabled?: boolean;
	readonly disabledMessage?: string;
	readonly onClick?: () => void;
}

function Vote({
	isUpvote,
	count,
	active,
	disabled = false,
	disabledMessage,
	onClick,
}: Readonly<VoteProps>) {
	const Icon = isUpvote ? ArrowBigUp : ArrowBigDown;
	const button = (
		<Button
			variant="ghost"
			size="sm"
			disabled={disabled}
			onClick={onClick}
			aria-pressed={active}
			aria-label={isUpvote ? "За" : "Проти"}
			className={cn(
				"h-8 gap-1.5 px-2 disabled:opacity-100",
				active ? "bg-primary/10 text-primary" : "text-muted-foreground",
			)}
		>
			<Icon className={cn("h-5 w-5", active && "fill-current")} />
			<span className="text-xs font-semibold tabular-nums">{count}</span>
		</Button>
	);

	if (!disabledMessage) {
		return button;
	}

	return (
		<Tooltip delayDuration={0}>
			<TooltipTrigger asChild>
				<span className="inline-flex">{button}</span>
			</TooltipTrigger>
			<TooltipContent side="top" sideOffset={4}>
				<p>{disabledMessage}</p>
			</TooltipContent>
		</Tooltip>
	);
}

export function RatingVotes({
	ratingId,
	courseId,
	initialUpvotes = 0,
	initialDownvotes = 0,
	initialUserVote = null,
	readOnly = false,
	disabledMessage,
	inline = false,
}: Readonly<RatingVotesProps>) {
	const queryClient = useQueryClient();
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
		(initialUserVote === RatingVoteStrType.UPVOTE ? -1 : 0) +
		(userVote === RatingVoteStrType.UPVOTE ? 1 : 0);
	const downvotes =
		initialDownvotes +
		(initialUserVote === RatingVoteStrType.DOWNVOTE ? -1 : 0) +
		(userVote === RatingVoteStrType.DOWNVOTE ? 1 : 0);

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
					await createVoteRef.current({
						ratingId,
						data: { vote_type: userVote },
					});
				}
				// Sync authority state on success only if still mounted
				if (isMounted) {
					setServerVote(userVote);
					if (courseId) {
						queryClient.invalidateQueries({
							queryKey: getCoursesRatingsListQueryKey(courseId),
							refetchType: "none",
						});
					}
				}
			} catch (error) {
				// Only handle error if still mounted
				if (isMounted) {
					console.error("Failed to sync vote with server:", error);
					toast.error("Не вдалося зберегти ваш голос. Спробуйте ще раз");
					// Revert optimistic state on error
					setUserVote(serverVote);
				}
			}
		}, 500); // 500ms debounce

		return () => {
			clearTimeout(timer);
			isMounted = false;
		};
	}, [userVote, serverVote, ratingId, courseId, queryClient]);

	const toggleVote = (target: RatingVoteStrType) => {
		if (readOnly) return;
		setUserVote((prev) => (prev === target ? null : target));
	};

	const upActive = userVote === RatingVoteStrType.UPVOTE;
	const downActive = userVote === RatingVoteStrType.DOWNVOTE;

	const wrapperClass = inline
		? "flex items-center gap-1"
		: "flex items-center gap-1 mt-3 justify-end";

	return (
		<div className={wrapperClass}>
			<Vote
				isUpvote
				count={upvotes}
				active={upActive}
				disabled={readOnly}
				disabledMessage={readOnly ? disabledMessage : undefined}
				onClick={() => toggleVote(RatingVoteStrType.UPVOTE)}
			/>

			<Vote
				isUpvote={false}
				count={downvotes}
				active={downActive}
				disabled={readOnly}
				disabledMessage={readOnly ? disabledMessage : undefined}
				onClick={() => toggleVote(RatingVoteStrType.DOWNVOTE)}
			/>
		</div>
	);
}

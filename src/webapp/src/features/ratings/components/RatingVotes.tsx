import { useEffect, useRef, useState } from "react";

import { useQueryClient } from "@tanstack/react-query";
import { ArrowBigDown, ArrowBigUp } from "lucide-react";

import { DisabledButtonWithTooltip } from "@/components/DisabledButtonWithTooltip";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toaster";
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
	/** Set when the viewer cannot vote; shown as the arrows' tooltip. */
	disabledReason?: string;
	inline?: boolean;
}

interface VoteProps {
	readonly isUpvote: boolean;
	readonly count: number;
	readonly active: boolean;
	readonly disabledReason?: string;
	readonly onClick: () => void;
}

// The new count slides in from the side it moved towards; the first render stays still.
function VoteCount({ count }: Readonly<{ count: number }>) {
	const [last, setLast] = useState({ count, rose: true, changed: false });
	if (count !== last.count) {
		setLast({ count, rose: count > last.count, changed: true });
	}
	return (
		<span className="inline-flex overflow-hidden text-xs font-semibold tabular-nums">
			<span
				key={count}
				className={cn(
					last.changed && [
						"animate-in fade-in-0 duration-200 ease-out motion-reduce:animate-none",
						last.rose ? "slide-in-from-bottom-3" : "slide-in-from-top-3",
					],
				)}
			>
				{count}
			</span>
		</span>
	);
}

function Vote({
	isUpvote,
	count,
	active,
	disabledReason,
	onClick,
}: Readonly<VoteProps>) {
	const Icon = isUpvote ? ArrowBigUp : ArrowBigDown;
	const disabled = disabledReason !== undefined;
	// The resting tone doubles as the hover tone, so disabled arrows do not react.
	const restingTone = active
		? "bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary"
		: "text-muted-foreground hover:bg-transparent hover:text-muted-foreground";
	const hoverTone = active
		? "hover:bg-primary/15"
		: "hover:bg-primary/10 hover:text-primary";
	const button = (
		<Button
			variant="ghost"
			size="sm"
			onClick={onClick}
			aria-pressed={active}
			aria-label={`${isUpvote ? "За" : "Проти"}: ${count}`}
			className={cn(
				"group/vote h-8 gap-1.5 px-2",
				restingTone,
				disabled ? "cursor-default" : hoverTone,
			)}
		>
			<Icon
				className={cn(
					"size-5 transition-transform duration-150 motion-reduce:transition-none",
					active && "fill-current",
					!disabled && "group-active/vote:scale-90",
				)}
			/>
			<VoteCount count={count} />
		</Button>
	);

	if (!disabled) {
		return button;
	}
	return (
		<DisabledButtonWithTooltip reason={disabledReason}>
			{button}
		</DisabledButtonWithTooltip>
	);
}

export function RatingVotes({
	ratingId,
	courseId,
	initialUpvotes = 0,
	initialDownvotes = 0,
	initialUserVote = null,
	disabledReason,
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

	// Counts derive from the server snapshot minus its own vote plus the local one.
	const countsFor = (vote: RatingVoteStrType | null) => ({
		upvotes:
			initialUpvotes +
			(initialUserVote === RatingVoteStrType.UPVOTE ? -1 : 0) +
			(vote === RatingVoteStrType.UPVOTE ? 1 : 0),
		downvotes:
			initialDownvotes +
			(initialUserVote === RatingVoteStrType.DOWNVOTE ? -1 : 0) +
			(vote === RatingVoteStrType.DOWNVOTE ? 1 : 0),
	});
	const { upvotes, downvotes } = countsFor(userVote);

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
				disabledReason={disabledReason}
				onClick={() => toggleVote(RatingVoteStrType.UPVOTE)}
			/>

			<Vote
				isUpvote={false}
				count={downvotes}
				active={downActive}
				disabledReason={disabledReason}
				onClick={() => toggleVote(RatingVoteStrType.DOWNVOTE)}
			/>
		</div>
	);
}

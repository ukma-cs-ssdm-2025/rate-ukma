import { useEffect, useRef, useState } from "react";

import { useQueryClient } from "@tanstack/react-query";
import { ArrowBigDown, ArrowBigUp } from "lucide-react";

import { DisabledButtonWithTooltip } from "@/components/DisabledButtonWithTooltip";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toaster";
import {
	getCoursesRatingsListQueryKey,
	RatingVoteStrType,
	useRatingsVotesDestroy,
	useRatingsVotesUpdate,
} from "@/lib/api/generated";
import { cn } from "@/lib/utils";

interface RatingVotesProps {
	ratingId: string;
	courseId?: string;
	initialUpvotes?: number;
	initialDownvotes?: number;
	initialUserVote?: RatingVoteStrType | null;
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
	const [userVote, setUserVote] = useState<RatingVoteStrType | null>(
		initialUserVote,
	);
	const wantedVote = useRef(initialUserVote);
	const confirmedVote = useRef(initialUserVote);
	const sending = useRef(false);

	const createVote = useRatingsVotesUpdate();
	const deleteVote = useRatingsVotesDestroy();

	const upvotes =
		initialUpvotes +
		(initialUserVote === RatingVoteStrType.UPVOTE ? -1 : 0) +
		(userVote === RatingVoteStrType.UPVOTE ? 1 : 0);
	const downvotes =
		initialDownvotes +
		(initialUserVote === RatingVoteStrType.DOWNVOTE ? -1 : 0) +
		(userVote === RatingVoteStrType.DOWNVOTE ? 1 : 0);

	useEffect(() => {
		if (sending.current) {
			return;
		}
		wantedVote.current = initialUserVote;
		confirmedVote.current = initialUserVote;
		setUserVote(initialUserVote);
	}, [initialUserVote]);

	const sendWantedVote = async () => {
		if (sending.current) {
			return;
		}
		sending.current = true;
		let saved = false;
		try {
			while (wantedVote.current !== confirmedVote.current) {
				const vote = wantedVote.current;
				if (vote === null) {
					await deleteVote.mutateAsync({ ratingId });
				} else {
					await createVote.mutateAsync({ ratingId, data: { vote_type: vote } });
				}
				confirmedVote.current = vote;
				saved = true;
			}
		} catch (error) {
			console.error("Failed to sync vote with server:", error);
			toast.error("Не вдалося зберегти ваш голос. Спробуйте ще раз");
			wantedVote.current = confirmedVote.current;
			setUserVote(confirmedVote.current);
		} finally {
			sending.current = false;
			if (saved && courseId) {
				void queryClient.invalidateQueries({
					queryKey: getCoursesRatingsListQueryKey(courseId),
					refetchType: "none",
				});
			}
		}
	};

	const toggleVote = (target: RatingVoteStrType) => {
		const next = wantedVote.current === target ? null : target;
		setUserVote(next);
		wantedVote.current = next;
		void sendWantedVote();
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

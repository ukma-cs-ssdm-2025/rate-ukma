import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/Tooltip";
import type { SyncJournalEntry, UkmaDataReviewCase } from "@/lib/api/generated";
import {
	getUkmaDataReviewCasesListQueryKey,
	getUkmaDataStatusRetrieveQueryKey,
	useUkmaDataCourseMerge,
	useUkmaDataCourseUnmerge,
	useUkmaDataReviewCaseDecide,
} from "@/lib/api/generated";
import {
	caseActionError,
	DECIDE_LABEL,
	decideConfirm,
	mergeConfirm,
	mergeLabel,
	unmergeConfirm,
	unmergeCourseId,
} from "../caseActions";
import { candidateIds, READ_ONLY } from "../reviewCases";
import { JOURNAL_QUERY_KEY } from "../syncQueries";

type Pending =
	| { kind: "decide"; reviewCase: UkmaDataReviewCase }
	| { kind: "merge"; reviewCase: UkmaDataReviewCase; into: string };

interface Result {
	ok: boolean;
	text: string;
}

export function invalidateCaseQueries(
	queryClient: ReturnType<typeof useQueryClient>,
) {
	void queryClient.invalidateQueries({
		queryKey: getUkmaDataReviewCasesListQueryKey(),
	});
	void queryClient.invalidateQueries({
		queryKey: getUkmaDataStatusRetrieveQueryKey(),
	});
	void queryClient.invalidateQueries({ queryKey: [JOURNAL_QUERY_KEY] });
}

function Guarded({
	enabled,
	children,
}: Readonly<{ enabled: boolean; children: ReactNode }>) {
	if (enabled) {
		return children;
	}
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<span className="inline-flex" tabIndex={0}>
					{children}
				</span>
			</TooltipTrigger>
			<TooltipContent side="top" className="max-w-xs">
				{READ_ONLY}
			</TooltipContent>
		</Tooltip>
	);
}

function ResultLine({ result }: Readonly<{ result: Result | null }>) {
	const ref = useRef<HTMLParagraphElement>(null);
	useEffect(() => {
		if (result) {
			ref.current?.focus();
		}
	}, [result]);
	if (!result) {
		return null;
	}
	return (
		<p
			ref={ref}
			role={result.ok ? "status" : "alert"}
			tabIndex={-1}
			className={
				result.ok
					? "max-w-72 text-sm whitespace-normal"
					: "max-w-72 text-sm whitespace-normal text-destructive"
			}
		>
			<span aria-hidden="true">{result.ok ? "✓" : "✗"}</span> {result.text}
		</p>
	);
}

export function CaseActions({
	reviewCase,
	decideEnabled,
}: Readonly<{ reviewCase: UkmaDataReviewCase; decideEnabled: boolean }>) {
	const queryClient = useQueryClient();
	const decide = useUkmaDataReviewCaseDecide();
	const merge = useUkmaDataCourseMerge();
	const [pending, setPending] = useState<Pending | null>(null);
	const [result, setResult] = useState<Result | null>(null);
	const busy = decide.isPending || merge.isPending;
	const candidates =
		reviewCase.kind === "course_match" ? candidateIds(reviewCase) : [];

	const onSuccess = (detail: string) => {
		setResult({ ok: true, text: detail });
		invalidateCaseQueries(queryClient);
	};
	const onError = (error: unknown) => {
		setResult({ ok: false, text: caseActionError(error) });
	};
	const confirm = () => {
		if (!pending || busy) {
			return;
		}
		if (pending.kind === "decide") {
			decide.mutate(
				{ caseId: pending.reviewCase.id },
				{
					onSuccess: (response) => onSuccess(response.detail),
					onError,
					onSettled: () => setPending(null),
				},
			);
			return;
		}
		merge.mutate(
			{
				courseId: pending.reviewCase.subject_id,
				data: { into: pending.into },
			},
			{
				onSuccess: (response) => onSuccess(response.detail),
				onError,
				onSettled: () => setPending(null),
			},
		);
	};

	if (reviewCase.status !== "open") {
		return <ResultLine result={result} />;
	}
	if (
		reviewCase.kind !== "student_match" &&
		reviewCase.kind !== "course_match"
	) {
		return null;
	}
	const dialog = pending === null ? null : confirmText(pending);
	return (
		<div className="flex flex-col gap-2">
			<div className="flex flex-wrap gap-2">
				{reviewCase.kind === "student_match" ? (
					<Guarded enabled={decideEnabled}>
						<Button
							size="sm"
							disabled={!decideEnabled || busy}
							onClick={() => setPending({ kind: "decide", reviewCase })}
						>
							{DECIDE_LABEL}
						</Button>
					</Guarded>
				) : (
					candidates.map((into) => (
						<Guarded key={into} enabled={decideEnabled}>
							<Button
								size="sm"
								disabled={!decideEnabled || busy}
								onClick={() => setPending({ kind: "merge", reviewCase, into })}
							>
								{mergeLabel(into)}
							</Button>
						</Guarded>
					))
				)}
			</div>
			<ResultLine result={result} />
			<ConfirmDialog
				open={pending !== null}
				onOpenChange={(open) => {
					if (!open) {
						setPending(null);
					}
				}}
				onConfirm={confirm}
				title={dialog?.title ?? ""}
				description={dialog?.description ?? ""}
				confirmText={pending?.kind === "merge" ? "Об'єднати" : "Закрити справу"}
			/>
		</div>
	);
}

function confirmText(pending: Pending) {
	return pending.kind === "decide"
		? decideConfirm(pending.reviewCase)
		: mergeConfirm(pending.reviewCase, pending.into);
}

export function UnmergeAction({
	entry,
	decideEnabled,
}: Readonly<{ entry: SyncJournalEntry; decideEnabled: boolean }>) {
	const queryClient = useQueryClient();
	const unmerge = useUkmaDataCourseUnmerge();
	const [open, setOpen] = useState(false);
	const [result, setResult] = useState<Result | null>(null);
	const targetId = unmergeCourseId(entry);
	if (targetId === null) {
		return null;
	}
	const confirm = unmergeConfirm(targetId);
	return (
		<div className="flex flex-col items-end gap-1">
			<Guarded enabled={decideEnabled}>
				<Button
					variant="outline"
					size="sm"
					disabled={!decideEnabled || unmerge.isPending}
					onClick={() => setOpen(true)}
				>
					Роз'єднати
				</Button>
			</Guarded>
			<ResultLine result={result} />
			<ConfirmDialog
				open={open}
				onOpenChange={setOpen}
				onConfirm={() => {
					unmerge.mutate(
						{ courseId: targetId },
						{
							onSuccess: (response) => {
								setResult({ ok: true, text: response.detail });
								invalidateCaseQueries(queryClient);
							},
							onError: (error) =>
								setResult({ ok: false, text: caseActionError(error) }),
							onSettled: () => setOpen(false),
						},
					);
				}}
				title={confirm.title}
				description={confirm.description}
				confirmText="Роз'єднати"
			/>
		</div>
	);
}

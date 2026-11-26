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
	useUkmaDataRecordsList,
	useUkmaDataReviewCaseDecide,
} from "@/lib/api/generated";
import {
	caseActionError,
	DECIDE_LABEL,
	decideConfirm,
	mergeConfirm,
	mergeLabel,
	ONLY_IN_SERVICE,
	unmergeConfirm,
	unmergeCourseId,
} from "../caseActions";
import { recordTitle, titleRepeats } from "../caseRecords";
import { candidateIds, NO_RETRY, READ_ONLY } from "../reviewCases";
import { JOURNAL_QUERY_KEY } from "../syncQueries";
import { useCaseRecords } from "./CaseRecords";

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

export function KeyCheckError({
	failed,
	retrying,
	onRetry,
}: Readonly<{ failed: boolean; retrying: boolean; onRetry: () => void }>) {
	if (!failed) {
		return null;
	}
	return (
		<div
			role="alert"
			className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3 text-sm"
		>
			<p>Не вдалося перевірити ключ UKMA Data, тому кнопки рішень вимкнено.</p>
			<Button variant="outline" size="sm" disabled={retrying} onClick={onRetry}>
				Спробувати ще
			</Button>
		</div>
	);
}

type CaseResult = Result & { caseId: string };

export function CaseActions({
	reviewCase,
	decideEnabled,
}: Readonly<{ reviewCase: UkmaDataReviewCase; decideEnabled: boolean }>) {
	const queryClient = useQueryClient();
	const decide = useUkmaDataReviewCaseDecide();
	const merge = useUkmaDataCourseMerge();
	const [pending, setPending] = useState<Pending | null>(null);
	const [answer, setAnswer] = useState<CaseResult | null>(null);
	const result = answer?.caseId === reviewCase.id ? answer : null;
	const busy = decide.isPending || merge.isPending;
	const candidates =
		reviewCase.kind === "course_match" ? candidateIds(reviewCase) : [];
	const records = useCaseRecords(reviewCase).data?.items;
	const name = (id: string) => recordTitle(records, id);
	const fullName = (id: string) => recordTitle(records, id, true);
	const repeats = titleRepeats(records, [reviewCase.subject_id, ...candidates]);

	const confirm = () => {
		if (!pending || busy) {
			return;
		}
		const caseId = pending.reviewCase.id;
		const onSuccess = (detail: string) => {
			setAnswer({ caseId, ok: true, text: detail });
			invalidateCaseQueries(queryClient);
		};
		const onError = (error: unknown) => {
			setAnswer({ caseId, ok: false, text: caseActionError(error) });
			invalidateCaseQueries(queryClient);
		};
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
		return <p className="text-muted-foreground">{ONLY_IN_SERVICE}</p>;
	}
	const dialog =
		pending === null
			? null
			: pending.kind === "decide"
				? decideConfirm(pending.reviewCase)
				: mergeConfirm(
						fullName(pending.reviewCase.subject_id),
						fullName(pending.into),
					);
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
								{mergeLabel(repeats ? fullName(into) : name(into))}
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

export function UnmergeAction({
	entry,
	decideEnabled,
}: Readonly<{ entry: SyncJournalEntry; decideEnabled: boolean }>) {
	const queryClient = useQueryClient();
	const unmerge = useUkmaDataCourseUnmerge();
	const [open, setOpen] = useState(false);
	const [result, setResult] = useState<Result | null>(null);
	const targetId = unmergeCourseId(entry);
	const records = useUkmaDataRecordsList(
		{ ids: targetId ?? "" },
		{ query: { ...NO_RETRY.query, enabled: targetId !== null } },
	).data?.items;
	if (targetId === null) {
		return null;
	}
	const confirm = unmergeConfirm(recordTitle(records, targetId));
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
							onError: (error) => {
								setResult({ ok: false, text: caseActionError(error) });
								invalidateCaseQueries(queryClient);
							},
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

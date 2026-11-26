import { useState } from "react";

import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
	useUkmaDataSyncQuestionsSettleUnrated,
	useUkmaDataSyncSummary,
} from "@/lib/api/generated";
import { actionFailure } from "../syncActions";
import { formatCount } from "../syncFormat";
import { NO_RETRY } from "../syncOverview";
import { invalidateSyncQueries } from "../syncQueries";
import { SyncApplyBar } from "./SyncApplyBar";

export function SettleUnrated() {
	const queryClient = useQueryClient();
	const [open, setOpen] = useState(false);
	const [result, setResult] = useState<{ ok: boolean; text: string } | null>(
		null,
	);
	const settle = useUkmaDataSyncQuestionsSettleUnrated({
		mutation: {
			onSuccess: (response) => setResult({ ok: true, text: response.detail }),
			onError: (failure) =>
				setResult({ ok: false, text: actionFailure(failure).text }),
			onSettled: () => invalidateSyncQueries(queryClient),
		},
	});
	return (
		<div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3 text-sm sm:px-5">
			<p className="min-w-0 flex-1 text-muted-foreground">
				Питання без оцінок можна закрити разом: дисципліни лишаться окремо, як
				зараз на сайті.
			</p>
			<Button
				size="sm"
				variant="outline"
				disabled={settle.isPending}
				onClick={() => setOpen(true)}
			>
				Лишити окремо всі без оцінок
			</Button>
			{result === null ? null : (
				<p
					role={result.ok ? "status" : "alert"}
					className={result.ok ? "w-full" : "w-full text-destructive"}
				>
					{result.text}
				</p>
			)}
			<ConfirmDialog
				open={open}
				onOpenChange={setOpen}
				onConfirm={() => {
					setOpen(false);
					settle.mutate();
				}}
				title="Лишити окремо всі питання без оцінок?"
				description="Обʼєднання отримають «лишити окремо», перенесення й переприв'язки «залишити як є». Питання з оцінками, питання про місце семестру й ті, що вже мають відповідь, не зміняться. Навчальні плани тут не перевіряються."
				confirmText="Лишити окремо"
				cancelText="Скасувати"
			/>
		</div>
	);
}

export function ApplyAnswers() {
	const summary = useUkmaDataSyncSummary({ source: "catalog" }, NO_RETRY);
	const data = summary.data;
	if (data === undefined) {
		return null;
	}
	const { merge, keep_apart, keep, place, move, relink } = data.answers;
	const answered = merge + keep_apart + keep + place + move + relink;
	if (answered === 0) {
		return null;
	}
	return (
		<SyncApplyBar
			selection={{
				source: "catalog",
				group: "mapping",
				rated: null,
				match: null,
				quiet: null,
				changed_field: null,
				run: data.run.id,
				exclude_ids: [],
			}}
			runId={data.run.id}
			selected={answered}
			total={answered}
			canReject={false}
			countText={`З відповіддю: ${formatCount(answered)}`}
			onDecided={() => undefined}
		/>
	);
}

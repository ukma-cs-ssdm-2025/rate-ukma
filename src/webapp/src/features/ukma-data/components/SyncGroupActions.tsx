import { useState } from "react";

import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { toast } from "@/components/ui/Toaster";
import { useUkmaDataSyncReject } from "@/lib/api/generated";
import { useSyncApplyLock } from "../hooks/useSyncApplyLock";
import { CHANGES_ACCUSATIVE, countWith, formatCount } from "../syncFormat";
import { BIG_APPLY, bulkLabel } from "../syncReview";

interface GroupActionsProps {
	selected: readonly number[];
	bulkCount: number | null | undefined;
	seen: number;
	similarExcluded: number | null;
	onApplySelected: () => void;
	onApplyAll: () => void;
	onRejected: () => void;
}

function BulkButton({
	count,
	seen,
	similarExcluded,
	locked,
	onApplyAll,
}: Readonly<{
	count: number | null;
	seen: number;
	similarExcluded: number | null;
	locked: boolean;
	onApplyAll: () => void;
}>) {
	const big = count === null || count > BIG_APPLY;
	return (
		<div className="flex flex-col items-stretch gap-1 sm:items-end">
			<Button
				variant="outline"
				disabled={locked || count === 0}
				onClick={onApplyAll}
				className={
					big ? "hidden w-full sm:w-auto md:inline-flex" : "w-full sm:w-auto"
				}
			>
				{bulkLabel(count, seen)}
			</Button>
			{big ? (
				<p className="text-xs text-muted-foreground md:hidden">
					Застосування великих груп — на компʼютері.
				</p>
			) : null}
			{similarExcluded !== null && similarExcluded > 0 ? (
				<p className="text-xs text-muted-foreground tabular-nums">
					Без {formatCount(similarExcluded)} схожих на наявні курси —
					перегляньте їх окремо.
				</p>
			) : null}
		</div>
	);
}

export function SyncGroupActions({
	selected,
	bulkCount,
	seen,
	similarExcluded,
	onApplySelected,
	onApplyAll,
	onRejected,
}: Readonly<GroupActionsProps>) {
	const queryClient = useQueryClient();
	const { locked } = useSyncApplyLock();
	const [confirmReject, setConfirmReject] = useState(false);
	const reject = useUkmaDataSyncReject({
		mutation: {
			onSuccess: () => {
				toast.success("Зміни відхилено");
				onRejected();
				void queryClient.invalidateQueries({
					predicate: (query) =>
						typeof query.queryKey[0] === "string" &&
						query.queryKey[0].startsWith("/api/v1/ukma-data/sync/"),
				});
			},
			onError: () => toast.error("Не вдалося відхилити зміни"),
		},
	});
	return (
		<>
			{bulkCount === undefined ? null : (
				<BulkButton
					count={bulkCount}
					seen={seen}
					similarExcluded={similarExcluded}
					locked={locked}
					onApplyAll={onApplyAll}
				/>
			)}
			{selected.length > 0 ? (
				<div
					role="region"
					aria-label="Дії з вибраними"
					className="fixed inset-x-0 bottom-0 z-40 border-t bg-card p-3 shadow-lg"
				>
					<div className="mx-auto flex max-w-5xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
						<p className="text-sm font-medium tabular-nums">
							Вибрано {formatCount(selected.length)}
						</p>
						<div className="flex flex-col gap-2 sm:flex-row">
							<Button
								variant="outline"
								className="w-full sm:w-auto"
								disabled={reject.isPending}
								onClick={() => setConfirmReject(true)}
							>
								Відхилити
							</Button>
							<Button
								className="w-full sm:w-auto"
								disabled={locked}
								onClick={onApplySelected}
							>
								Застосувати
							</Button>
						</div>
					</div>
				</div>
			) : null}
			<ConfirmDialog
				open={confirmReject}
				onOpenChange={setConfirmReject}
				title="Відхилити вибрані зміни?"
				description={`Буде відхилено ${countWith(selected.length, CHANGES_ACCUSATIVE)}. Наступний запуск може запропонувати їх знову, якщо дані зміняться.`}
				confirmText="Відхилити"
				onConfirm={() => {
					setConfirmReject(false);
					reject.mutate({ data: { change_ids: [...selected] } });
				}}
			/>
		</>
	);
}

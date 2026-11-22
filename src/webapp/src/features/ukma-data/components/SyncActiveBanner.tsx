import { useState } from "react";

import { CheckCircle2, Loader2 } from "lucide-react";
import { useQueryStates } from "nuqs";

import { Button } from "@/components/ui/Button";
import type { SyncApprovalDetail } from "@/lib/api/generated";
import { useCurrentEmail, useSyncApplyLock } from "../hooks/useSyncApplyLock";
import { formatTime } from "../syncFormat";
import { historyParams, tabParser } from "../syncParams";

export function approverName(
	email: string | null,
	currentEmail: string | null,
): string {
	if (email === null) {
		return "нічний запуск";
	}
	return email === currentEmail ? "ви" : email;
}

function Running({ approval }: Readonly<{ approval: SyncApprovalDetail }>) {
	const currentEmail = useCurrentEmail();
	return (
		<div
			role="status"
			className="flex items-start gap-2 rounded-lg border border-caution bg-caution/30 p-3 text-sm"
		>
			<Loader2 className="mt-0.5 size-4 shrink-0 animate-spin motion-reduce:animate-none" />
			<p>
				<span className="font-medium">Застосовується:</span>{" "}
				{approval.selection} — {approverName(approval.user_email, currentEmail)}
				, почато о {formatTime(approval.created_at)}. Кнопки застосування
				вимкнено, доки воно не завершиться.
			</p>
		</div>
	);
}

function Finished({
	approval,
	onDismiss,
}: Readonly<{ approval: SyncApprovalDetail; onDismiss: () => void }>) {
	const [, setParams] = useQueryStates({ tab: tabParser, ...historyParams });
	return (
		<div
			role="status"
			className="flex flex-col gap-2 rounded-lg border border-success/40 bg-success/10 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
		>
			<p className="flex items-start gap-2">
				<CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
				<span>Застосування завершено: {approval.selection}.</span>
			</p>
			<div className="flex flex-col gap-2 sm:flex-row">
				<Button
					variant="outline"
					size="sm"
					onClick={() =>
						void setParams({ tab: "history", openRun: approval.run_id })
					}
				>
					Відкрити в історії
				</Button>
				<Button variant="ghost" size="sm" onClick={onDismiss}>
					Закрити
				</Button>
			</div>
		</div>
	);
}

export function SyncActiveBanner() {
	const { active } = useSyncApplyLock();
	const [last, setLast] = useState<SyncApprovalDetail | null>(null);
	const [dismissed, setDismissed] = useState<number | null>(null);
	if (active !== null && active.id !== last?.id) {
		setLast(active);
	}
	if (active !== null) {
		return <Running approval={active} />;
	}
	if (last === null || dismissed === last.id) {
		return null;
	}
	return <Finished approval={last} onDismiss={() => setDismissed(last.id)} />;
}

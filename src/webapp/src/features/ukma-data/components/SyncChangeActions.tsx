import { Button } from "@/components/ui/Button";
import type { AnswerEnum, SyncChange } from "@/lib/api/generated";
import { isMappingChange, isRemovedChange } from "../syncActions";
import { MappingAnswerControls } from "./MappingAnswerControls";

export function SyncChangeActions({
	change,
	busy,
	onApprove,
	onReject,
	onAnswer,
}: Readonly<{
	change: SyncChange;
	busy: boolean;
	onApprove: (change: SyncChange) => void;
	onReject: (change: SyncChange) => void;
	onAnswer: (change: SyncChange, answer: AnswerEnum, into?: string) => void;
}>) {
	const removed = isRemovedChange(change);
	return (
		<div className="flex flex-wrap items-start gap-2">
			<Button size="sm" disabled={busy} onClick={() => onApprove(change)}>
				{removed ? "Позначити переглянутим" : "Підтвердити"}
			</Button>
			{removed ? null : (
				<Button
					size="sm"
					variant="outline"
					disabled={busy}
					onClick={() => onReject(change)}
				>
					Відхилити
				</Button>
			)}
			{isMappingChange(change) ? (
				<MappingAnswerControls
					change={change}
					busy={busy}
					onAnswer={(answer, into) => onAnswer(change, answer, into)}
				/>
			) : null}
		</div>
	);
}

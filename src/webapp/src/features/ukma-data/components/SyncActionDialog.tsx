import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { STALE_TITLE } from "../syncActions";
import type { SyncActionDialog as Dialog } from "../useSyncActions";

export function SyncActionDialog({
	dialog,
	onClose,
	onConfirm,
}: Readonly<{
	dialog: Dialog | null;
	onClose: () => void;
	onConfirm: () => void;
}>) {
	if (dialog === null) {
		return null;
	}
	if (dialog.kind === "preview") {
		return (
			<ConfirmDialog
				open
				onOpenChange={(open) => {
					if (!open) {
						onClose();
					}
				}}
				onConfirm={onConfirm}
				title="Переглянути перед застосуванням"
				description={`${dialog.counts}. Підтвердьте, щоб застосувати зміни.`}
				confirmText="Застосувати"
			/>
		);
	}
	if (dialog.kind === "stale") {
		return (
			<ConfirmDialog
				open
				onOpenChange={(open) => {
					if (!open) {
						onClose();
					}
				}}
				onConfirm={onConfirm}
				title={STALE_TITLE}
				description={`${dialog.detail}. Продовжити попри вік даних?`}
				confirmText="Продовжити"
			/>
		);
	}
	if (dialog.kind === "reject") {
		return (
			<ConfirmDialog
				open
				onOpenChange={(open) => {
					if (!open) {
						onClose();
					}
				}}
				onConfirm={onConfirm}
				title="Відхилити зміни?"
				description={`Буде відхилено змін: ${dialog.rows}. Наступний запуск може запропонувати їх знову.`}
				confirmText="Відхилити"
				variant="destructive"
			/>
		);
	}
	return (
		<ConfirmDialog
			open
			onOpenChange={(open) => {
				if (!open) {
					onClose();
				}
			}}
			onConfirm={onConfirm}
			title="Залишити окремо всі без оцінок?"
			description="Для кожного невирішеного питання зіставлення без оцінок запишеться безпечна відповідь «залишити окремо» або «залишити»."
			confirmText="Залишити окремо"
		/>
	);
}

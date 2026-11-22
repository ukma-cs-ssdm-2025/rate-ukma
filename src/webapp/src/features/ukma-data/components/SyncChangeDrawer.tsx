import { X } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import type { SyncChange } from "@/lib/api/generated";
import { SyncChangeCard } from "./SyncChangeCard";

export function SyncChangeDrawer({
	change,
	onClose,
}: Readonly<{ change: SyncChange | null; onClose: () => void }>) {
	return (
		<Drawer
			open={change !== null}
			onOpenChange={(open) => {
				if (!open) {
					onClose();
				}
			}}
			ariaLabel="Деталі зміни"
		>
			<div
				className="flex items-center justify-between gap-2"
				onKeyDown={(event) => {
					if (event.key === "Escape") {
						onClose();
					}
				}}
			>
				<h2 className="text-lg font-semibold">Деталі зміни</h2>
				<Button
					variant="ghost"
					size="icon"
					onClick={onClose}
					aria-label="Закрити деталі"
					autoFocus
				>
					<X />
				</Button>
			</div>
			{change === null ? null : <SyncChangeCard change={change} />}
		</Drawer>
	);
}

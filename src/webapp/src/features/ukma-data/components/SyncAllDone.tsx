import { Check } from "lucide-react";

import { Button } from "@/components/ui/Button";
import type { DoneLine } from "../syncGroups";

export function SyncAllDone({
	done,
	onHistory,
}: Readonly<{
	done: readonly DoneLine[];
	onHistory: (runId: number | null) => void;
}>) {
	const latest = done[0];
	return (
		<section className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
			<span className="flex size-12 items-center justify-center rounded-full bg-tint-success text-success">
				<Check className="size-6" aria-hidden />
			</span>
			<h2 className="text-xl font-semibold">Усе вирішено</h2>
			<p className="text-muted-foreground">
				Нових змін із САЗ немає. Наступна перевірка — завтра о 02:30.
			</p>
			<Button
				variant="link"
				onClick={() => onHistory(latest === undefined ? null : latest.runId)}
			>
				Що застосовано сьогодні
			</Button>
		</section>
	);
}

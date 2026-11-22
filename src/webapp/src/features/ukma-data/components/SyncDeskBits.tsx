import { Button } from "@/components/ui/Button";
import { formatCount } from "../syncFormat";
import { Kbd } from "./DataBits";

export function LaterButton({ onLater }: Readonly<{ onLater: () => void }>) {
	return (
		<Button variant="ghost" size="lg" onClick={onLater} className="sm:ml-auto">
			Вирішу пізніше <Kbd>→</Kbd>
		</Button>
	);
}

export function DecisionsBar({
	count,
	onApply,
}: Readonly<{ count: number; onApply: () => void }>) {
	return (
		<div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
			<p className="text-sm text-muted-foreground">
				{count === 0
					? "Ваших рішень поки немає. Вони зберігаються одразу, а на сайті змінюються, коли ви їх застосуєте."
					: `Ваших рішень: ${formatCount(count)}. Вони збережені; на сайті зміняться, коли ви їх застосуєте.`}
			</p>
			<Button
				variant={count === 0 ? "outline" : "default"}
				disabled={count === 0}
				onClick={onApply}
			>
				{count === 0
					? "Застосувати рішення"
					: `Застосувати рішення (${formatCount(count)})`}
			</Button>
		</div>
	);
}

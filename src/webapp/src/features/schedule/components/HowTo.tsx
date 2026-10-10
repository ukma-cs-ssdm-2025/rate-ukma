import { Info } from "lucide-react";
import { KEYS } from "@/features/schedule/components/Hotkeys";
import { CalendarLegend } from "@/features/schedule/components/PlannerCalendar";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/Dialog";
import { Kbd } from "@/components/ui/Kbd";
import { useIsMobile } from "@/lib/hooks/useIsMobile";

interface Props {
	readonly open: boolean;
	readonly onOpenChange: (open: boolean) => void;
}

/**
 * Reference dialog from the account menu: the grid legend and the keys,
 * rendered from the real components, never copies. The three-step coach
 * lives in the first-steps banner over the grid, where the work happens.
 */
export function HowTo({ open, onOpenChange }: Props) {
	const isMobile = useIsMobile();
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="max-h-[calc(100svh-2rem)] max-w-sm overflow-y-auto"
				data-testid="howto-dialog"
			>
				<DialogHeader>
					<DialogTitle>Як користуватися</DialogTitle>
					<DialogDescription>
						Що означає сітка і де що натискати.
					</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col gap-1.5">
					<p className="text-xs font-medium text-foreground">
						Позначення на сітці
					</p>
					<CalendarLegend />
				</div>
				<div className="flex flex-col gap-1.5" data-testid="howto-fixes">
					<p className="text-xs font-medium text-foreground">
						Коли розклад не збігається
					</p>
					<ul className="flex list-disc flex-col gap-1 pl-4 text-xs text-muted-foreground">
						<li>
							Викладач переніс пару, змінив аудиторію чи тижні: «Змінити пару» в{" "}
							{isMobile ? "деталях пари" : "меню «⋯» пари"}. Працює й у
							зафіксованому розкладі.
						</li>
						<li>
							Пари немає в жодному файлі: «Додати свою пару» в пошуку дисциплін
							або в меню рядка «Без розкладу».
						</li>
						<li>
							Не ходиш на дисципліну з ІНП: сховай її. Вона не впливатиме на
							накладки й фіксацію.
						</li>
					</ul>
				</div>
				<div className="flex flex-col gap-1.5 max-md:hidden">
					<p className="text-xs font-medium text-foreground">Клавіші</p>
					<dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
						{KEYS.map(([key, what]) => (
							<div key={key} className="contents">
								<dt>
									<Kbd className="font-mono text-xs text-foreground">{key}</Kbd>
								</dt>
								<dd className="text-muted-foreground">{what}</dd>
							</div>
						))}
					</dl>
				</div>
				<p className="flex items-center gap-2 text-xs text-muted-foreground">
					{isMobile ? (
						<>
							<span>
								Деталі кожної пари за кнопкою{" "}
								<Info
									aria-label="Деталі"
									className="inline size-3.5 align-[-2px]"
								/>{" "}
								поруч із нею.
							</span>
						</>
					) : (
						<>
							<Kbd aria-label="знак питання">?</Kbd>
							<span>Натисни знак питання будь-де, щоб повернутися сюди.</span>
						</>
					)}
				</p>
			</DialogContent>
		</Dialog>
	);
}

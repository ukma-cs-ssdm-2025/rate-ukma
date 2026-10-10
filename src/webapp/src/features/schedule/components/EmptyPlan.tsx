import {
	ArrowRight,
	CalendarPlus,
	Lock,
	MousePointerClick,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EVENT_STYLE } from "@/features/schedule/lib/calendar-events";

/** The three commitments, shown where the grid will be. Lock stays step 2
 *  everywhere: banner, rail and welcome teach the same order. */
const STEPS = [
	{
		icon: MousePointerClick,
		title: "Обери групи",
		body: "Натисни по одній групі в кожній дисципліні. Сірі варіанти теж можна натиснути: вони пояснюють, що заважає.",
	},
	{
		icon: Lock,
		title: "Зафіксуй план",
		body: "Коли в кожній дисципліні є група, кнопка «Зафіксувати розклад» у списку дисциплін стає доступною.",
	},
	{
		icon: CalendarPlus,
		title: "Забери в календар",
		body: "Кнопка «У календар» підписує Google, Outlook чи Apple або дає разову копію.",
	},
] as const;

/** The plan holds no disciplines yet — on either presentation. */
export function EmptyPlan({ onBrowse }: { onBrowse?: () => void }) {
	return (
		<div
			data-testid="planner-calendar"
			className="mx-auto flex w-full max-w-xl flex-col items-center px-4 py-10 text-center"
		>
			<p className=" text-lg font-semibold text-foreground">
				Розклад зʼявиться тут
			</p>
			<p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
				Додай дисципліни, натисни по групі в кожній — і сітка стане твоїм
				тижнем.
			</p>
			<ol className="mt-5 flex w-full flex-col gap-2 text-left">
				{STEPS.map((item, index) => {
					const ItemIcon = item.icon;
					return (
						<li
							key={item.title}
							className="flex items-start gap-3 rounded-lg border border-border/60 bg-card px-3 py-2.5"
						>
							<span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
								<ItemIcon className="size-4" />
							</span>
							<span className="min-w-0">
								<span className="block text-sm font-medium text-foreground">
									{index + 1}. {item.title}
								</span>
								<span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
									{item.body}
								</span>
							</span>
						</li>
					);
				})}
			</ol>
			<div className="mt-2 flex w-full items-center gap-2 rounded-lg border border-border/60 bg-card px-3 py-2.5 text-left">
				<span
					className={`inline-block size-3 shrink-0 rounded-xs border ${EVENT_STYLE.open}`}
				/>
				<span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
					Так виглядає група, яку можна обрати
				</span>
				{onBrowse !== undefined && (
					<Button
						size="xs"
						data-testid="empty-browse"
						onClick={onBrowse}
						className="shrink-0"
					>
						Додати дисципліни <ArrowRight />
					</Button>
				)}
			</div>
		</div>
	);
}

/** The clashes view with nothing colliding. */
export function NoClashes() {
	return (
		<p
			data-testid="no-clashes"
			className="px-3 py-2 text-xs text-muted-foreground"
		>
			Накладок у плані немає.
		</p>
	);
}

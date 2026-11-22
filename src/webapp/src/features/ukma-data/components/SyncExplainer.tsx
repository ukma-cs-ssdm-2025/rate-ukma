import { useEffect, useState } from "react";

import { ChevronDown, CircleHelp } from "lucide-react";

import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/Collapsible";
import { localStorageAdapter } from "@/lib/storage";

export const EXPLAINER_KEY = "rate-ukma:sync-explainer-seen";

const GROUPS = [
	[
		"Ті самі, що в САЗ",
		"Дисципліна вже є на сайті й у САЗ. Підтвердження лише запам'ятовує, що це одне й те саме.",
	],
	[
		"Нове",
		"У САЗ є дисципліни й семестри, яких на сайті ще немає. Після підтвердження вони з'являться в каталозі.",
	],
	[
		"Оновлені дані",
		"У САЗ змінились кредити, форма контролю, тип занять тощо. Студенти побачать нові значення.",
	],
	[
		"Схожі на дублікати",
		"Дві сторінки на сайті — одна дисципліна в САЗ. Ви вирішуєте, чи об'єднати їх.",
	],
	[
		"Семестри без дисципліни",
		"САЗ не каже, до якої з однойменних дисциплін належить семестр. Ви обираєте сторінку.",
	],
] as const;

const firstVisit = (): boolean =>
	localStorageAdapter.getItem<boolean>(EXPLAINER_KEY) !== true;

export function SyncExplainer() {
	const [open, setOpen] = useState(firstVisit);
	useEffect(() => {
		localStorageAdapter.setItem(EXPLAINER_KEY, true);
	}, []);
	return (
		<Collapsible
			open={open}
			onOpenChange={setOpen}
			className="rounded-xl border border-tint-info-border bg-tint-info"
		>
			<CollapsibleTrigger className="flex w-full items-center gap-3 px-4 py-3 text-left">
				<CircleHelp className="size-5 shrink-0 text-primary" />
				<span className="font-medium">Що це за сторінка</span>
				<span className="hidden min-w-0 flex-1 truncate text-sm text-muted-foreground sm:inline">
					— звідки ці зміни і що буде, якщо їх підтвердити
				</span>
				<span className="ml-auto flex items-center gap-1 text-sm text-muted-foreground">
					{open ? "Сховати" : null}
					<ChevronDown
						className={open ? "size-4 rotate-180" : "size-4"}
						aria-hidden
					/>
				</span>
			</CollapsibleTrigger>
			<CollapsibleContent className="max-w-3xl space-y-3 px-4 pb-4 text-sm sm:pl-12">
				<p>
					Щоночі сайт порівнює свої дисципліни з САЗ — університетською
					системою, де ведуть дисципліни, семестри й коди. Усе, що
					відрізняється, чекає тут.
				</p>
				<p>
					<strong>
						Без вашого підтвердження на сайті нічого не змінюється.
					</strong>{" "}
					Пропущене повернеться наступної ночі, якщо в САЗ так і залишиться.
				</p>
				<p>
					Оцінки студентів не губляться. Вони переходять на іншу сторінку
					дисципліни лише тоді, коли ви самі об'єднуєте дві сторінки в одну.
				</p>
				<dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[max-content_1fr]">
					{GROUPS.map(([term, description]) => (
						<div key={term} className="contents">
							<dt className="font-semibold">{term}</dt>
							<dd className="text-muted-foreground">{description}</dd>
						</div>
					))}
				</dl>
			</CollapsibleContent>
		</Collapsible>
	);
}

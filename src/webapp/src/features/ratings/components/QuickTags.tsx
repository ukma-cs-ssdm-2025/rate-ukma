import { useState } from "react";

import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

// Prototype: tags stay in the form for now; nothing is sent yet.
const TAGS = [
	"Цікаві лекції",
	"Багато домашки",
	"Легкий екзамен",
	"Строгий екзамен",
	"Обов'язкова відвідуваність",
	"Корисна практика",
	"Багато читання",
] as const;

/** One-tap facts about the course, so a rating says more without typing. */
export function QuickTags() {
	const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());

	const toggle = (tag: string) =>
		setPicked((previous) => {
			const next = new Set(previous);
			if (next.has(tag)) next.delete(tag);
			else next.add(tag);
			return next;
		});

	return (
		<fieldset className="space-y-2">
			<legend className="flex items-center gap-2 text-sm leading-none font-medium">
				Що варто знати
				<span className="font-normal text-muted-foreground">необов'язково</span>
			</legend>
			<div className="flex flex-wrap gap-1.5 pt-1">
				{TAGS.map((tag) => {
					const on = picked.has(tag);
					return (
						<button
							key={tag}
							type="button"
							aria-pressed={on}
							onClick={() => toggle(tag)}
							className={cn(
								"inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-full border px-3 text-sm transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none motion-reduce:transition-none",
								on
									? "border-primary bg-primary/10 text-primary"
									: "text-foreground hover:bg-accent",
							)}
						>
							{on && <Check className="size-3.5" aria-hidden="true" />}
							{tag}
						</button>
					);
				})}
			</div>
		</fieldset>
	);
}

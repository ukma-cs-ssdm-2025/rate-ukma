import { Link } from "@tanstack/react-router";

import { buttonVariants } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { formatCount } from "../syncFormat";
import { STEP_COPY } from "../syncSteps";
import type { InboxStep } from "../syncSteps";

function StepRow({ item, next }: Readonly<{ item: InboxStep; next: boolean }>) {
	return (
		<li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-4 sm:flex-nowrap sm:px-5">
			<div className="min-w-0 flex-1 basis-full sm:basis-auto">
				<h3 className="font-medium">{item.title}</h3>
				<p className="text-sm text-muted-foreground">{item.text}</p>
			</div>
			<span className="text-lg font-medium tabular-nums sm:w-24 sm:text-right">
				{formatCount(item.count)}
			</span>
			<Link
				to="/data/sync/preview"
				search={{ step: item.step }}
				aria-label={`${item.title}: переглянути`}
				className={cn(
					buttonVariants({
						variant: next ? "default" : "outline",
						size: "sm",
					}),
					"ml-auto sm:ml-0 sm:w-28",
				)}
			>
				Переглянути
			</Link>
		</li>
	);
}

export function SyncStepList({ steps }: Readonly<{ steps: InboxStep[] }>) {
	return (
		<ul
			aria-label="Що чекає рішення"
			className="divide-y overflow-hidden rounded-xl border bg-card"
		>
			{steps.map((item, index) => (
				<StepRow
					key={item.step}
					item={item}
					next={
						index === steps.findIndex((step) => STEP_COPY[step.step].decidable)
					}
				/>
			))}
		</ul>
	);
}

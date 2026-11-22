import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/Tooltip";
import { cn } from "@/lib/utils";
import { formatFullDate, timeAgo } from "../syncFormat";
import { TERMS } from "../syncTerms";
import type { TermName } from "../syncTerms";

const DOTTED =
	"cursor-help rounded-sm underline decoration-dotted decoration-muted-foreground/70 underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

function Hint({
	text,
	hint,
	className,
}: Readonly<{ text: React.ReactNode; hint: string; className?: string }>) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<button type="button" className={cn(DOTTED, className)}>
					{text}
				</button>
			</TooltipTrigger>
			<TooltipContent
				side="bottom"
				sideOffset={4}
				collisionPadding={16}
				className="max-w-xs"
			>
				{hint}
			</TooltipContent>
		</Tooltip>
	);
}

export function Term({
	name,
	children,
	className,
}: Readonly<{
	name: TermName;
	children?: React.ReactNode;
	className?: string;
}>) {
	const term = TERMS[name];
	return (
		<Hint
			text={children ?? term.label}
			hint={term.hint}
			className={className}
		/>
	);
}

export function Ago({ iso }: Readonly<{ iso: string }>) {
	return (
		<Hint
			text={<time dateTime={iso}>{timeAgo(iso)}</time>}
			hint={formatFullDate(iso)}
			className="tabular-nums"
		/>
	);
}

export function DataSection({
	title,
	lead,
	children,
}: Readonly<{
	title: string;
	lead: React.ReactNode;
	children: React.ReactNode;
}>) {
	return (
		<section className="space-y-3">
			<div className="space-y-1">
				<h2 className="text-lg font-semibold">{title}</h2>
				<p className="text-sm text-muted-foreground">{lead}</p>
			</div>
			{children}
		</section>
	);
}

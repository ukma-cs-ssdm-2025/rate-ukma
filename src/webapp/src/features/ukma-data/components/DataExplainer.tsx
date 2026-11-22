import { useEffect, useState } from "react";

import { ChevronDown, CircleHelp } from "lucide-react";

import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/Collapsible";
import { localStorageAdapter } from "@/lib/storage";

const firstVisit = (storageKey: string): boolean =>
	localStorageAdapter.getItem<boolean>(storageKey) !== true;

export function DataExplainer({
	title,
	hint,
	storageKey,
	children,
}: Readonly<{
	title: string;
	hint: string;
	storageKey: string;
	children: React.ReactNode;
}>) {
	const [open, setOpen] = useState(() => firstVisit(storageKey));
	useEffect(() => {
		localStorageAdapter.setItem(storageKey, true);
	}, [storageKey]);
	return (
		<Collapsible
			open={open}
			onOpenChange={setOpen}
			className="rounded-xl border border-tint-info-border bg-tint-info"
		>
			<CollapsibleTrigger className="flex w-full items-center gap-3 px-4 py-3 text-left">
				<CircleHelp className="size-5 shrink-0 text-primary" />
				<span className="font-medium">{title}</span>
				<span className="hidden min-w-0 flex-1 truncate text-sm text-muted-foreground sm:inline">
					— {hint}
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
				{children}
			</CollapsibleContent>
		</Collapsible>
	);
}

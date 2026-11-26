import type * as React from "react";

import { cn } from "@/lib/utils";

function Switch({
	checked,
	onCheckedChange,
	className,
	...props
}: Omit<React.ComponentProps<"button">, "onChange"> & {
	checked: boolean;
	onCheckedChange: (checked: boolean) => void;
}) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			data-state={checked ? "checked" : "unchecked"}
			data-slot="switch"
			className={cn(
				"peer inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-transparent transition-colors duration-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
				checked ? "bg-primary" : "bg-input dark:bg-input/80",
				className,
			)}
			onClick={() => onCheckedChange(!checked)}
			{...props}
		>
			<span
				data-slot="switch-thumb"
				className={cn(
					"pointer-events-none block size-4 rounded-full bg-background transition-transform duration-200",
					checked ? "translate-x-4" : "translate-x-0.5",
				)}
			/>
		</button>
	);
}

export { Switch };

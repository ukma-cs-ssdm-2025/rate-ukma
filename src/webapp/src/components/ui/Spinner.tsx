import { Loader2Icon } from "lucide-react";

import { cn } from "@/lib/utils";

function Spinner({
	className,
	...props
}: Readonly<React.ComponentProps<"div">>) {
	return (
		// biome-ignore lint/a11y/useSemanticElements: Loading spinner is a status indicator, not a calculation result
		<div
			role="status"
			aria-label="Loading"
			className={cn("inline-flex", className)}
			{...props}
		>
			<Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
		</div>
	);
}

export { Spinner };

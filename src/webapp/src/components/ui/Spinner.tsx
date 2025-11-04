import { Loader2Icon } from "lucide-react";

import { cn } from "@/lib/utils";

function Spinner({
	className,
	...props
}: Readonly<React.ComponentProps<"output">>) {
	return (
		<output
			aria-label="Loading"
			className={cn("inline-flex", className)}
			{...props}
		>
			<Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
		</output>
	);
}

export { Spinner };

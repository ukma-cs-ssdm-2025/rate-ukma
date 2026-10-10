import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// The dense type steps (styles.css: --text-mini, --text-meta). Without this,
// tailwind-merge reads `text-mini` as a colour and drops it next to a
// `text-*-foreground`.
const twMerge = extendTailwindMerge({
	extend: { classGroups: { "font-size": [{ text: ["mini", "meta"] }] } },
});

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

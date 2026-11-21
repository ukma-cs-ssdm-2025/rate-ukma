import "react";

declare module "react" {
	// Inline styles set design-token CSS variables (`--gap`, `--normal-bg`).
	interface CSSProperties {
		[variable: `--${string}`]: string | number | undefined;
	}
}

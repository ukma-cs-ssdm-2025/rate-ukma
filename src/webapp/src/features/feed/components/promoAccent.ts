import type { FeedPromoAccent } from "../feedTypes";

/** Badge and Button share these variant names, so one value drives both. */
type AccentVariant = "default" | "secondary" | "destructive";

interface AccentStyles {
	container: string;
	rail: string;
	variant: AccentVariant;
	/** Darkens the CTA where the variant's own fill is too pale to read as a button. */
	cta?: string;
}

const ACCENT_STYLES: Record<FeedPromoAccent, AccentStyles> = {
	BRAND: {
		container: "bg-primary/5 border-primary/20",
		rail: "bg-primary",
		variant: "default",
	},
	INFO: {
		container: "bg-accent border-border",
		rail: "bg-muted-foreground",
		variant: "secondary",
		cta: "bg-muted-foreground text-background hover:bg-muted-foreground/90",
	},
	WARNING: {
		container: "bg-destructive/5 border-destructive/20",
		rail: "bg-destructive",
		variant: "destructive",
	},
};

export const DEFAULT_PROMO_LABEL = "Оголошення";

/**
 * A server-side accent this bundle predates is a plain object miss, so
 * `??` on the key alone would still leave the lookup undefined.
 */
export function getAccentStyles(
	accent: FeedPromoAccent | undefined,
): AccentStyles {
	return ACCENT_STYLES[accent ?? "BRAND"] ?? ACCENT_STYLES.BRAND;
}

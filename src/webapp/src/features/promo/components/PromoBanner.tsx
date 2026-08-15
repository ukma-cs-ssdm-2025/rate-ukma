import { ArrowRight, X } from "lucide-react";

import { Button } from "@/components/ui/Button";
import type { PromoBannerContent } from "@/features/promo/promoConfig";
import { PROMO_BANNER_CONTENT } from "@/features/promo/promoConfig";
import { usePromoDismissal } from "@/features/promo/hooks/usePromoDismissal";
import { useFeatureFlag, useFeatureFlags } from "@/lib/feature-flags";
import { testIds } from "@/lib/test-ids";

export const PROMO_BANNER_FLAG = "fe_promo_banner";

interface PromoBannerProps {
	readonly content?: PromoBannerContent;
}

export function PromoBanner({
	content = PROMO_BANNER_CONTENT,
}: Readonly<PromoBannerProps>) {
	const { isReady } = useFeatureFlags();
	const isEnabled = useFeatureFlag(PROMO_BANNER_FLAG);
	const { isDismissed, dismiss } = usePromoDismissal(content.id);

	// `isReady` gate avoids a flash of the banner before flags resolve.
	if (!isReady || !isEnabled || isDismissed) return null;

	return (
		<aside
			aria-label="Партнерське оголошення"
			className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 shadow-sm"
			data-testid={testIds.promo.banner}
		>
			<img
				src={content.logoUrl}
				alt={content.logoAlt}
				width={32}
				height={32}
				className="size-8 shrink-0 rounded-md"
				loading="lazy"
			/>

			<p className="min-w-0 flex-1 truncate text-sm">
				<span className="font-medium">{content.title}</span>
				{content.description ? (
					<span className="ml-2 hidden text-muted-foreground sm:inline">
						{content.description}
					</span>
				) : null}
			</p>

			<a
				href={content.href}
				target="_blank"
				rel="noreferrer noopener"
				onClick={() => {
					console.info("promo_banner_click", { promoId: content.id });
				}}
				className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline"
				data-testid={testIds.promo.link}
			>
				{content.ctaLabel}
				<ArrowRight className="size-4" />
			</a>

			<Button
				variant="ghost"
				size="icon-sm"
				onClick={dismiss}
				aria-label="Сховати оголошення"
				data-testid={testIds.promo.dismissButton}
			>
				<X className="size-4" />
			</Button>
		</aside>
	);
}

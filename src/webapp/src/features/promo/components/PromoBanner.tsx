import { ArrowRight, X } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { usePromoDismissal } from "@/features/promo/hooks/usePromoDismissal";
import { usePromoBannerList } from "@/lib/api/generated";
import { testIds } from "@/lib/test-ids";

export function PromoBanner() {
	// Visibility is the backend's call: the endpoint serves the active banner
	// configured in admin, or null when there is none.
	const { data } = usePromoBannerList();

	const banner = data?.banner ?? null;
	const { isDismissed, dismiss } = usePromoDismissal(banner?.id ?? "");

	if (isDismissed) return null;
	if (!banner?.id || !banner.title || !banner.href) return null;

	return (
		<aside
			aria-label="Партнерське оголошення"
			className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 shadow-sm"
			data-testid={testIds.promo.banner}
		>
			{banner.logo_url ? (
				<img
					src={banner.logo_url}
					alt={banner.logo_alt || banner.title}
					width={32}
					height={32}
					className="size-8 shrink-0 rounded-md"
					loading="lazy"
				/>
			) : null}

			<p className="min-w-0 flex-1 truncate text-sm">
				<span className="font-medium">{banner.title}</span>
				{banner.description ? (
					<span className="ml-2 hidden text-muted-foreground sm:inline">
						{banner.description}
					</span>
				) : null}
			</p>

			<a
				href={banner.href}
				target="_blank"
				rel="noreferrer noopener"
				onClick={() => {
					console.info("promo_banner_click", { promoId: banner.id });
				}}
				className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline"
				data-testid={testIds.promo.link}
			>
				{banner.cta_label}
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

import { Check, ChevronsUpDown, Star } from "lucide-react";

import { Button } from "@/components/ui/Button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { testIds } from "@/lib/test-ids";
import { cn } from "@/lib/utils";
import { PRODUCTS, type ProductId } from "./products";

/** ukma-schedule's mark: staggered day-bars, one of them yours. */
function ScheduleGlyph({ className }: Readonly<{ className?: string }>) {
	return (
		<svg
			viewBox="0 0 24 24"
			aria-hidden="true"
			className={className}
			fill="currentColor"
		>
			<rect x="3" y="8" width="4" height="8" rx="2" opacity="0.45" />
			<rect x="10" y="4" width="4" height="6.5" rx="2" opacity="0.45" />
			<rect x="10" y="12" width="4" height="8" rx="2" />
			<rect x="17" y="6.5" width="4" height="9.5" rx="2" opacity="0.45" />
		</svg>
	);
}

/** The logo tile both products share: the primary square, each product's own glyph. */
export function ProductMark({
	product,
	className,
}: Readonly<{ product: ProductId; className?: string }>) {
	return (
		<span
			className={cn(
				"flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm",
				className,
			)}
		>
			{product === "rate" ? (
				<Star
					className="size-4 text-primary-foreground"
					fill="currentColor"
					aria-hidden="true"
				/>
			) : (
				<ScheduleGlyph className="size-[1.125rem] text-primary-foreground" />
			)}
		</span>
	);
}

/**
 * Beside the logo: the other student product, one click away and already
 * signed in through the same Microsoft account. ukma-schedule's header
 * carries the same menu.
 */
export function ProductSwitcher({ current }: Readonly<{ current: ProductId }>) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					aria-label="Інші продукти НаУКМА"
					title="Інші продукти НаУКМА"
					data-testid={testIds.header.productSwitcher}
					className="size-7 text-muted-foreground"
				>
					<ChevronsUpDown />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-80">
				<DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
					Продукти для студентів НаУКМА
				</DropdownMenuLabel>
				{PRODUCTS.map((product) => (
					<DropdownMenuItem
						key={product.id}
						asChild
						data-testid={`product-${product.id}`}
						className="cursor-pointer gap-3 py-2"
					>
						<a href={product.id === current ? "/" : product.href}>
							<ProductMark product={product.id} />
							<span className="flex min-w-0 flex-1 flex-col">
								<span className="truncate text-sm font-medium text-foreground">
									{product.name}
								</span>
								<span className="truncate text-xs text-muted-foreground">
									{product.blurb}
								</span>
							</span>
							{product.id === current && <Check className="text-primary" />}
						</a>
					</DropdownMenuItem>
				))}
				<DropdownMenuSeparator />
				<p className="px-2 py-1.5 text-xs text-muted-foreground">
					Один вхід через акаунт НаУКМА для обох.
				</p>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

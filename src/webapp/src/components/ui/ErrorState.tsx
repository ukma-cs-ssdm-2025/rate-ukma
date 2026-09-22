import type { ComponentProps, ReactNode } from "react";

import { AlertTriangle, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/Button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/Empty";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/utils";

interface ErrorStateProps extends Omit<ComponentProps<"div">, "title"> {
	readonly title: ReactNode;
	readonly description?: ReactNode;
	readonly icon?: LucideIcon;
	readonly onRetry?: () => void;
	readonly isRetrying?: boolean;
	readonly retryTestId?: string;
}

export function ErrorState({
	title,
	description,
	icon: Icon = AlertTriangle,
	onRetry,
	isRetrying,
	retryTestId,
	className,
	...props
}: Readonly<ErrorStateProps>) {
	return (
		<Empty className={cn("border-0 py-16", className)} {...props}>
			<EmptyHeader>
				<EmptyMedia
					variant="icon"
					className="bg-destructive/10 text-destructive"
				>
					<Icon />
				</EmptyMedia>
				<EmptyTitle>{title}</EmptyTitle>
				{description ? (
					<EmptyDescription>{description}</EmptyDescription>
				) : null}
			</EmptyHeader>
			{onRetry ? (
				<EmptyContent>
					<Button
						variant="outline"
						onClick={onRetry}
						disabled={isRetrying}
						data-testid={retryTestId}
					>
						{isRetrying ? <Spinner className="mr-2" /> : null}
						Спробувати знову
					</Button>
				</EmptyContent>
			) : null}
		</Empty>
	);
}

import type * as React from "react";

import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/Dialog";
import { cn } from "@/lib/utils";

type AlertDialogProps = React.ComponentProps<typeof Dialog>;

export function AlertDialog(props: Readonly<AlertDialogProps>) {
	return <Dialog {...props} />;
}

type AlertDialogContentProps = React.ComponentProps<typeof DialogContent>;

export function AlertDialogContent({
	showCloseButton = false,
	...props
}: Readonly<AlertDialogContentProps>) {
	return <DialogContent showCloseButton={showCloseButton} {...props} />;
}

type AlertDialogHeaderProps = React.ComponentProps<typeof DialogHeader>;

export function AlertDialogHeader(props: Readonly<AlertDialogHeaderProps>) {
	return <DialogHeader {...props} />;
}

type AlertDialogTitleProps = React.ComponentProps<typeof DialogTitle>;

export function AlertDialogTitle(props: Readonly<AlertDialogTitleProps>) {
	return <DialogTitle {...props} />;
}

type AlertDialogDescriptionProps = React.ComponentProps<
	typeof DialogDescription
>;

export function AlertDialogDescription(
	props: Readonly<AlertDialogDescriptionProps>,
) {
	return <DialogDescription {...props} />;
}

type AlertDialogFooterProps = React.ComponentProps<typeof DialogFooter>;

export function AlertDialogFooter(props: Readonly<AlertDialogFooterProps>) {
	return <DialogFooter {...props} />;
}

type AlertDialogActionProps = React.ComponentPropsWithoutRef<"button">;

export function AlertDialogAction({
	className,
	type = "button",
	...props
}: Readonly<AlertDialogActionProps>) {
	return (
		<button
			type={type}
			className={cn(
				"inline-flex h-10 items-center justify-center rounded-md px-4 py-2",
				"bg-primary text-primary-foreground font-medium",
				"hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2",
				"focus-visible:ring-ring focus-visible:ring-offset-2",
				"disabled:pointer-events-none disabled:opacity-50",
				className,
			)}
			{...props}
		/>
	);
}

type AlertDialogCancelProps = React.ComponentPropsWithoutRef<"button">;

export function AlertDialogCancel({
	className,
	type = "button",
	...props
}: Readonly<AlertDialogCancelProps>) {
	return (
		<DialogClose asChild>
			<button
				type={type}
				className={cn(
					"inline-flex h-10 items-center justify-center rounded-md px-4 py-2",
					"border border-input bg-background font-medium",
					"hover:bg-accent hover:text-accent-foreground",
					"focus-visible:outline-none focus-visible:ring-2",
					"focus-visible:ring-ring focus-visible:ring-offset-2",
					"disabled:pointer-events-none disabled:opacity-50",
					className,
				)}
				{...props}
			/>
		</DialogClose>
	);
}

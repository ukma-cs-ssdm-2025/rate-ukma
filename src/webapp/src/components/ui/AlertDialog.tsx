import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

interface AlertDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	children: React.ReactNode;
}

export function AlertDialog({
	open,
	onOpenChange,
	children,
}: Readonly<AlertDialogProps>) {
	const [isMounted, setIsMounted] = useState(open);

	useEffect(() => {
		if (open) {
			setIsMounted(true);
			document.body.style.overflow = "hidden";
			return () => {
				document.body.style.overflow = "";
			};
		}
		const timer = setTimeout(() => setIsMounted(false), 200);
		document.body.style.overflow = "";
		return () => {
			clearTimeout(timer);
			document.body.style.overflow = "";
		};
	}, [open]);

	useEffect(() => {
		const handleEscape = (event: KeyboardEvent) => {
			if (event.key === "Escape" && open) {
				onOpenChange(false);
			}
		};

		document.addEventListener("keydown", handleEscape);
		return () => document.removeEventListener("keydown", handleEscape);
	}, [open, onOpenChange]);

	if (!isMounted) return null;

	return (
		<div
			className={cn(
				"fixed inset-0 z-50 flex items-center justify-center",
				"transition-opacity duration-200 ease-in-out",
				open ? "opacity-100" : "opacity-0 pointer-events-none",
			)}
		>
			{/* Backdrop */}
			<button
				type="button"
				tabIndex={-1}
				aria-label="Close dialog"
				className="fixed inset-0 bg-black/50 transition-opacity duration-200"
				onClick={() => onOpenChange(false)}
			/>
			{/* Content */}
			{children}
		</div>
	);
}

interface AlertDialogContentProps {
	children: React.ReactNode;
	className?: string;
}

export function AlertDialogContent({
	children,
	className,
}: Readonly<AlertDialogContentProps>) {
	return (
		<div
			role="dialog"
			aria-modal="true"
			className={cn(
				"relative z-50 w-full max-w-md rounded-lg bg-background p-6 shadow-lg",
				"transform transition-all duration-200 ease-out",
				"scale-100 opacity-100",
				className,
			)}
		>
			{children}
		</div>
	);
}

interface AlertDialogHeaderProps {
	children: React.ReactNode;
}

export function AlertDialogHeader({
	children,
}: Readonly<AlertDialogHeaderProps>) {
	return <div className="mb-4 space-y-2">{children}</div>;
}

interface AlertDialogTitleProps {
	children: React.ReactNode;
}

export function AlertDialogTitle({
	children,
}: Readonly<AlertDialogTitleProps>) {
	return (
		<h2 className="text-lg font-semibold leading-none tracking-tight">
			{children}
		</h2>
	);
}

interface AlertDialogDescriptionProps {
	children: React.ReactNode;
}

export function AlertDialogDescription({
	children,
}: Readonly<AlertDialogDescriptionProps>) {
	return <p className="text-sm text-muted-foreground">{children}</p>;
}

interface AlertDialogFooterProps {
	children: React.ReactNode;
}

export function AlertDialogFooter({
	children,
}: Readonly<AlertDialogFooterProps>) {
	return (
		<div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
			{children}
		</div>
	);
}

interface AlertDialogActionProps {
	children: React.ReactNode;
	onClick?: () => void;
	className?: string;
}

export function AlertDialogAction({
	children,
	onClick,
	className,
}: Readonly<AlertDialogActionProps>) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"inline-flex h-10 items-center justify-center rounded-md px-4 py-2",
				"bg-primary text-primary-foreground font-medium",
				"hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2",
				"focus-visible:ring-ring focus-visible:ring-offset-2",
				"disabled:pointer-events-none disabled:opacity-50",
				className,
			)}
		>
			{children}
		</button>
	);
}

interface AlertDialogCancelProps {
	children: React.ReactNode;
	onClick?: () => void;
}

export function AlertDialogCancel({
	children,
	onClick,
}: Readonly<AlertDialogCancelProps>) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"inline-flex h-10 items-center justify-center rounded-md px-4 py-2",
				"border border-input bg-background font-medium",
				"hover:bg-accent hover:text-accent-foreground",
				"focus-visible:outline-none focus-visible:ring-2",
				"focus-visible:ring-ring focus-visible:ring-offset-2",
				"disabled:pointer-events-none disabled:opacity-50",
			)}
		>
			{children}
		</button>
	);
}

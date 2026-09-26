import { useNavigate } from "@tanstack/react-router";
import {
	type FallbackProps,
	ErrorBoundary as ReactErrorBoundary,
} from "react-error-boundary";

import { Button } from "./ui/Button";

function ErrorFallback({ resetErrorBoundary }: Readonly<FallbackProps>) {
	const navigate = useNavigate();

	const handleRetry = () => {
		resetErrorBoundary();
	};

	const handleGoHome = () => {
		resetErrorBoundary();
		navigate({ to: "/" });
	};

	return (
		<div className="flex min-h-screen items-center justify-center bg-background px-6 py-8">
			<div className="w-full max-w-md space-y-6 rounded-2xl border bg-card p-6 text-center text-card-foreground shadow-sm md:p-8">
				<div className="space-y-2">
					<h1 className="text-2xl font-bold tracking-tight">
						Щось пішло не так
					</h1>
					<p className="text-base text-muted-foreground">
						Виникла помилка під час завантаження сторінки.
					</p>
				</div>
				<div className="flex flex-col gap-2">
					<Button
						onClick={handleRetry}
						className="h-11 w-full text-base font-medium"
					>
						Спробувати знову
					</Button>
					<Button
						onClick={handleGoHome}
						className="h-11 w-full"
						variant="outline"
					>
						На головну
					</Button>
				</div>
			</div>
		</div>
	);
}

interface ErrorBoundaryProps {
	children: React.ReactNode;
	fallback?: React.ComponentType<FallbackProps>;
	onError?: (
		error: Error,
		info: { componentStack: string | null | undefined },
	) => void;
}

export function ErrorBoundary({
	children,
	fallback = ErrorFallback,
	onError,
}: Readonly<ErrorBoundaryProps>) {
	return (
		<ReactErrorBoundary
			FallbackComponent={fallback}
			onError={(error, info) => {
				console.error("Error caught by ErrorBoundary:", error, info);
				const err = error instanceof Error ? error : new Error(String(error));
				onError?.(err, { componentStack: info.componentStack || null });
			}}
		>
			{children}
		</ReactErrorBoundary>
	);
}

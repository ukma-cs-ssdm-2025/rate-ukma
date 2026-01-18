import { useNavigate } from "@tanstack/react-router";
import {
	ErrorBoundary as ReactErrorBoundary,
	type FallbackProps,
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
		<div className="flex min-h-screen flex-col items-center justify-center px-4">
			<div className="text-center max-w-md">
				<h2 className="text-2xl font-bold text-foreground mb-4">
					Щось пішло не так
				</h2>
				<p className="text-muted-foreground mb-6">
					Виникла помилка під час завантаження сторінки. Спробуйте ще раз або
					поверніться пізніше.
				</p>
				<div className="flex gap-3 justify-center">
					<Button onClick={handleRetry} className="min-w-[120px]">
						Спробувати знову
					</Button>
					<Button
						onClick={handleGoHome}
						className="min-w-[120px]"
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

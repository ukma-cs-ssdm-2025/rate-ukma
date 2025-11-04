import { ErrorBoundary as ReactErrorBoundary } from "react-error-boundary";

import { Button } from "./ui/Button";

function ErrorFallback({
	resetErrorBoundary,
}: Readonly<{
	resetErrorBoundary: () => void;
}>) {
	return (
		<div className="flex min-h-screen flex-col items-center justify-center px-4">
			<div className="text-center max-w-md">
				<h2 className="text-2xl font-bold text-foreground mb-4">
					Щось пішло не так
				</h2>
				<p className="text-muted-foreground mb-6">
					Виникла помилка під час завантаження сторінки. Спробуйте оновити
					сторінку або повернутися пізніше.
				</p>
				<Button onClick={resetErrorBoundary} className="min-w-[120px]">
					Спробувати знову
				</Button>
			</div>
		</div>
	);
}

interface ErrorBoundaryProps {
	children: React.ReactNode;
	fallback?: React.ComponentType<{
		error: Error;
		resetErrorBoundary: () => void;
	}>;
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
				onError?.(error, { componentStack: info.componentStack || null });
			}}
		>
			{children}
		</ReactErrorBoundary>
	);
}

import { useCallback, useEffect, useState } from "react";

import { createFileRoute } from "@tanstack/react-router";
import axios from "axios";
import { AlertTriangle, Loader2, ServerOff, WifiOff } from "lucide-react";

import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/ui/Button";
import { env } from "@/env";
import { authSessionRetrieve } from "@/lib/api/generated";
import {
	type ConnectionIssueReason,
	isOffline,
	resetRedirectFlag,
} from "@/lib/api/networkError";

type ConnectionErrorSearch = {
	reason?: ConnectionIssueReason;
	from?: string;
};

export const Route = createFileRoute("/connection-error")({
	component: ConnectionErrorPage,
	validateSearch: (search: Record<string, string>): ConnectionErrorSearch => {
		const reason = search.reason;
		if (reason === "offline" || reason === "server" || reason === "unknown") {
			return {
				reason,
				from: search.from,
			};
		}
		return {};
	},
});

type AttemptOptions = {
	silent?: boolean;
};

function ConnectionErrorPage() {
	const { reason = "unknown", from } = Route.useSearch();
	const [isChecking, setIsChecking] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const skipOfflineCheck = env.VITE_SKIP_OFFLINE_CHECK;

	const attemptReconnect = useCallback(
		async (options?: AttemptOptions) => {
			const silent = options?.silent === true;
			if (!silent) {
				setErrorMessage(null);
			}
			setIsChecking(true);

			if (
				shouldBlockDueToOffline({
					setError: setErrorMessage,
					silent,
					skipOfflineCheck,
				})
			) {
				setIsChecking(false);
				return false;
			}

			try {
				await authSessionRetrieve();
				globalThis.location.replace(getSafeRedirectTarget(from));
				return true;
			} catch (error) {
				if (!silent) {
					const message = getReconnectErrorMessage(error, skipOfflineCheck);
					if (message) {
						setErrorMessage(message);
					}
				}
			} finally {
				setIsChecking(false);
			}

			return false;
		},
		[skipOfflineCheck, from],
	);

	useEffect(() => {
		resetRedirectFlag();
		attemptReconnect({ silent: true }).catch(() => undefined);
	}, [attemptReconnect]);

	const handleRetry = () => {
		attemptReconnect().catch(() => undefined);
	};

	return (
		<AuthShell
			footer={
				<p className="text-xs text-muted-foreground">{getFooterText(reason)}</p>
			}
		>
			<div className="space-y-6">
				<div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
					{reason === "offline" ? (
						<WifiOff className="h-8 w-8 text-destructive" />
					) : reason === "server" ? (
						<ServerOff className="h-8 w-8 text-destructive" />
					) : (
						<AlertTriangle className="h-8 w-8 text-destructive" />
					)}
				</div>

				<div className="space-y-2">
					<h1 className="text-2xl font-bold text-foreground">
						Проблема з'єднання
					</h1>
					<p className="text-base text-muted-foreground">
						{getDescription(reason)}
					</p>
				</div>

				<Button
					onClick={handleRetry}
					className="w-full gap-2 h-12 text-base font-medium"
					disabled={isChecking}
				>
					{isChecking ? (
						<>
							<Loader2 className="h-5 w-5 animate-spin" />
							Перевірка...
						</>
					) : (
						"Перевірити з'єднання"
					)}
				</Button>

				{errorMessage ? (
					<p className="text-sm text-destructive" role="alert">
						{errorMessage}
					</p>
				) : null}
			</div>
		</AuthShell>
	);
}

function getDescription(reason: ConnectionIssueReason) {
	return {
		offline:
			"Схоже, що ви не маєте доступу до мережі. Підключіться до інтернету та спробуйте знову.",
		server:
			"Сервер тимчасово недоступний або не відповідає. Спробуйте повторити запит трохи пізніше.",
		unknown:
			"Не вдалося підключитися до сервера. Перевірте з'єднання та натисніть кнопку нижче.",
	}[reason];
}

function getFooterText(reason: ConnectionIssueReason) {
	return {
		offline:
			"Переконайтеся, що ви підключені до Wi‑Fi або мобільної мережі, і повторіть спробу.",
		server:
			"Якщо проблема триває, повідомте адміністратора або спробуйте пізніше – можливо, йде технічне обслуговування.",
		unknown:
			"Якщо ситуація не змінюється, перевірте підключення та зверніться до підтримки при необхідності.",
	}[reason];
}

const DEFAULT_REDIRECT_TARGET = "/";
const OFFLINE_INITIAL_MESSAGE =
	"Ви офлайн. Підключіться до мережі та спробуйте знову.";
const OFFLINE_RETRY_MESSAGE = "Ви офлайн. Перевірте підключення до мережі.";

const shouldBlockDueToOffline = ({
	setError,
	silent,
	skipOfflineCheck,
}: {
	setError: (message: string) => void;
	silent: boolean;
	skipOfflineCheck: boolean;
}) => {
	if (skipOfflineCheck || !isOffline()) {
		return false;
	}

	if (!silent) {
		setError(OFFLINE_INITIAL_MESSAGE);
	}

	return true;
};

const getReconnectErrorMessage = (
	error: unknown,
	skipOfflineCheck: boolean,
): string | null => {
	if (!skipOfflineCheck && isOffline()) {
		return OFFLINE_RETRY_MESSAGE;
	}

	if (!axios.isAxiosError(error)) {
		if (error instanceof DOMException && error.name === "AbortError") {
			return "Час очікування перевищено. Спробуйте пізніше.";
		}
		return "Не вдалося встановити з'єднання. Спробуйте пізніше.";
	}

	const status = error.response?.status;
	if (status && status >= 500) {
		return "Сервер тимчасово недоступний. Спробуйте пізніше.";
	}

	if (status) {
		return `Сервер відповів з кодом ${status}. Спробуйте ще раз.`;
	}

	return "Не вдалося встановити з'єднання. Спробуйте пізніше.";
};

const getSafeRedirectTarget = (from?: string) => {
	if (!from) {
		return DEFAULT_REDIRECT_TARGET;
	}

	try {
		const url = new URL(from, globalThis.location.origin);
		if (url.origin !== globalThis.location.origin) {
			return DEFAULT_REDIRECT_TARGET;
		}

		const normalized = `${url.pathname}${url.search}${url.hash}`;
		return normalized || DEFAULT_REDIRECT_TARGET;
	} catch {
		return DEFAULT_REDIRECT_TARGET;
	}
};

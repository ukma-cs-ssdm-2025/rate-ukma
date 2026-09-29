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
	BOUNCES_PARAM,
	isOffline,
	parseBounceCount,
	resetRedirectFlag,
} from "@/lib/api/networkError";

export type ConnectionErrorSearch = {
	reason?: ConnectionIssueReason;
	from?: string;
	bounces?: number;
};

/**
 * Silent auto-return is only trustworthy for a real offline→online
 * transition (the browser fires `online`, and a session probe success means
 * the API is reachable again). A `server` probe can succeed while the heavy
 * page that bounced still times out, which ping-pongs the user between the
 * page and this error screen — so server reasons always wait for a manual
 * retry. Past the cap even offline returns stay manual.
 */
export const MAX_AUTO_RETURN_BOUNCES = 2;

export const shouldAutoReturn = (
	reason: ConnectionIssueReason,
	bounces: number,
): boolean => reason === "offline" && bounces <= MAX_AUTO_RETURN_BOUNCES;

export const Route = createFileRoute("/connection-error")({
	component: ConnectionErrorRoute,
	validateSearch: (search: Record<string, string>): ConnectionErrorSearch => {
		const validated: ConnectionErrorSearch = {
			bounces: parseBounceCount(search.bounces),
		};
		const reason = search.reason;
		if (reason === "offline" || reason === "server" || reason === "unknown") {
			validated.reason = reason;
			validated.from = search.from;
		}
		return validated;
	},
});

function ConnectionErrorRoute() {
	const search = Route.useSearch();
	return <ConnectionErrorPage {...search} />;
}

type AttemptOptions = {
	silent?: boolean;
};

export function ConnectionErrorPage({
	reason = "unknown",
	from,
	bounces = 0,
}: ConnectionErrorSearch) {
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
				globalThis.location.replace(getSafeRedirectTarget(from, bounces));
				return true;
			} catch (error) {
				if (axios.isAxiosError(error) && error.response?.status === 401) {
					redirectToLogin(from, bounces);
					return true;
				}

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
		[skipOfflineCheck, from, bounces],
	);

	useEffect(() => {
		resetRedirectFlag();
		if (!shouldAutoReturn(reason, bounces)) {
			return;
		}
		attemptReconnect({ silent: true }).catch(() => undefined);

		const onOnline = () => {
			attemptReconnect({ silent: true }).catch(() => undefined);
		};
		globalThis.addEventListener("online", onOnline);
		return () => {
			globalThis.removeEventListener("online", onOnline);
		};
	}, [attemptReconnect, reason, bounces]);

	const handleRetry = () => {
		attemptReconnect().catch(() => undefined);
	};

	return (
		<AuthShell>
			<div className="space-y-6">
				<div aria-hidden="true" className="flex justify-center">
					{getReasonIcon(reason)}
				</div>

				<div className="space-y-2">
					<h1 className="text-2xl font-bold tracking-tight text-foreground">
						Проблема з'єднання
					</h1>
					<p className="text-base text-muted-foreground">
						{getDescription(reason)}
					</p>
				</div>

				<Button
					onClick={handleRetry}
					className="h-11 w-full text-base font-medium"
					disabled={isChecking}
				>
					{isChecking ? (
						<>
							<Loader2 className="size-5 animate-spin motion-reduce:animate-none" />
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

const redirectToLogin = (from?: string, bounces = 0) => {
	const redirectTarget = getSafeRedirectTarget(from, bounces);
	const loginUrl = new URL("/login", globalThis.location.origin);
	loginUrl.searchParams.set("redirect", redirectTarget);

	globalThis.location.replace(loginUrl.toString());
};

export const getSafeRedirectTarget = (from?: string, bounces = 0) => {
	if (!from) {
		return withBounceCount(DEFAULT_REDIRECT_TARGET, bounces);
	}

	try {
		const url = new URL(from, globalThis.location.origin);
		if (url.origin !== globalThis.location.origin) {
			return DEFAULT_REDIRECT_TARGET;
		}

		const normalized = `${url.pathname}${url.search}${url.hash}`;
		return withBounceCount(normalized || DEFAULT_REDIRECT_TARGET, bounces);
	} catch {
		return DEFAULT_REDIRECT_TARGET;
	}
};

/**
 * Stamps the current bounce count onto the return target, so the next
 * failure can count one higher instead of restarting at one. Zero leaves
 * the URL untouched.
 */
export const withBounceCount = (target: string, bounces: number): string => {
	if (bounces <= 0) {
		return target;
	}
	const url = new URL(target, globalThis.location.origin);
	url.searchParams.set(BOUNCES_PARAM, String(bounces));
	return `${url.pathname}${url.search}${url.hash}`;
};

const getReasonIcon = (reason: ConnectionIssueReason) => {
	let Icon = null;

	switch (reason) {
		case "offline":
			Icon = WifiOff;
			break;
		case "server":
			Icon = ServerOff;
			break;
		default:
			Icon = AlertTriangle;
			break;
	}

	return <Icon className="size-8 text-muted-foreground" aria-hidden="true" />;
};

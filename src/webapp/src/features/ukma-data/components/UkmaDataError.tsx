import { useEffect } from "react";

import { useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { AlertTriangle, CloudOff, Settings, ShieldAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { ErrorState } from "@/components/ui/ErrorState";
import {
	authSessionRetrieve,
	getAuthSessionRetrieveQueryKey,
} from "@/lib/api/generated";
import { notifySessionExpired } from "@/lib/auth/sessionExpiry";
import { errorCopy, ukmaErrorKind } from "../ukmaDataErrors";
import type { UkmaErrorKind } from "../ukmaDataErrors";

const ICONS = {
	forbidden: ShieldAlert,
	staff: ShieldAlert,
	down: CloudOff,
	unset: Settings,
	other: AlertTriangle,
} satisfies Record<UkmaErrorKind, LucideIcon>;

export function useStaffRecheck(kind: UkmaErrorKind) {
	const queryClient = useQueryClient();
	useEffect(() => {
		if (kind !== "staff") {
			return;
		}
		let active = true;
		authSessionRetrieve()
			.then((session) => {
				if (active) {
					queryClient.setQueryData(getAuthSessionRetrieveQueryKey(), session);
				}
			})
			.catch((sessionError: unknown) => {
				if (
					active &&
					axios.isAxiosError(sessionError) &&
					sessionError.response?.status === 401
				) {
					notifySessionExpired();
				}
			});
		return () => {
			active = false;
		};
	}, [kind, queryClient]);
}

export function UkmaDataError({
	error,
	title,
	onRetry,
	isRetrying,
}: Readonly<{
	error: unknown;
	title: string;
	onRetry: () => void;
	isRetrying: boolean;
}>) {
	const kind = ukmaErrorKind(error);
	useStaffRecheck(kind);
	const copy = errorCopy(kind, title);
	return (
		<ErrorState
			icon={ICONS[kind]}
			title={copy.title}
			description={copy.description ?? undefined}
			onRetry={copy.retry ? onRetry : undefined}
			isRetrying={isRetrying}
		/>
	);
}

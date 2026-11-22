import { useEffect } from "react";

import { useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { CloudOff, Settings, ShieldAlert } from "lucide-react";

import { ErrorState } from "@/components/ui/ErrorState";
import {
	authSessionRetrieve,
	getAuthSessionRetrieveQueryKey,
} from "@/lib/api/generated";
import { notifySessionExpired } from "@/lib/auth/sessionExpiry";
import { StaffOnlyState } from "./DataSectionHeader";

const UKMA_DATA_FORBIDDEN = "ukma_data_forbidden";

interface ErrorBody {
	readonly code?: unknown;
}

function responseCode(error: unknown): string | undefined {
	if (!axios.isAxiosError<ErrorBody>(error)) {
		return undefined;
	}
	const code = error.response?.data?.code;
	return typeof code === "string" ? code : undefined;
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
	const queryClient = useQueryClient();
	const status = axios.isAxiosError(error) ? error.response?.status : undefined;
	const ukmaDataForbidden =
		status === 403 && responseCode(error) === UKMA_DATA_FORBIDDEN;

	useEffect(() => {
		if (status !== 403 || ukmaDataForbidden) {
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
	}, [status, ukmaDataForbidden, queryClient]);

	switch (status) {
		case 403:
			return ukmaDataForbidden ? (
				<ErrorState
					icon={ShieldAlert}
					title="Немає доступу до цих даних UKMA Data"
					description="Ключ UKMA Data цього сервера не має дозволу на цей розділ. Інші розділи працюють."
				/>
			) : (
				<StaffOnlyState />
			);
		case 502:
			return (
				<ErrorState
					icon={CloudOff}
					title="UKMA Data зараз недоступний"
					description="Rate UKMA не отримав від нього правильної відповіді. Спробуйте трохи згодом."
					onRetry={onRetry}
					isRetrying={isRetrying}
				/>
			);
		case 503:
			return (
				<ErrorState
					icon={Settings}
					title="UKMA Data не налаштовано"
					description="Серверу Rate UKMA бракує адреси або ключа UKMA Data. Зверніться до адміністратора."
				/>
			);
		default:
			return (
				<ErrorState title={title} onRetry={onRetry} isRetrying={isRetrying} />
			);
	}
}

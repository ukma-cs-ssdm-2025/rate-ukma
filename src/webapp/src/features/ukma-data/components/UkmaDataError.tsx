import { useEffect } from "react";

import { useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { CloudOff, Settings } from "lucide-react";

import { ErrorState } from "@/components/ui/ErrorState";
import {
	authSessionRetrieve,
	getAuthSessionRetrieveQueryKey,
} from "@/lib/api/generated";
import { notifySessionExpired } from "@/lib/auth/sessionExpiry";
import { StaffOnlyState } from "./DataSectionHeader";

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

	// DRF answers 403 both to a non-superuser and to an ended session. Ask the
	// session which one it is without refetching its query: a refetch unmounts
	// the section, and the remount would hit the 403 again.
	useEffect(() => {
		if (status !== 403) return;
		authSessionRetrieve()
			.then((session) =>
				queryClient.setQueryData(getAuthSessionRetrieveQueryKey(), session),
			)
			.catch((sessionError: unknown) => {
				if (
					axios.isAxiosError(sessionError) &&
					sessionError.response?.status === 401
				) {
					notifySessionExpired();
				}
			});
	}, [status, queryClient]);

	switch (status) {
		case 403:
			return <StaffOnlyState />;
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

import { useEffect } from "react";

import { useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { CloudOff, Settings } from "lucide-react";

import { ErrorState } from "@/components/ui/ErrorState";
import { getAuthSessionRetrieveQueryKey } from "@/lib/api/generated";
import { StaffOnlyState } from "./DataSectionHeader";

/** The proxy's answer for a failed UKMA Data call: 403, 502, 503 or anything else. */
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

	// The session said superuser but the server did not agree: reload it, so a
	// session that really ended still goes to the login page.
	useEffect(() => {
		if (status === 403) {
			queryClient.invalidateQueries({
				queryKey: getAuthSessionRetrieveQueryKey(),
			});
		}
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

import axios from "axios";

export const UKMA_DATA_FORBIDDEN = "ukma_data_forbidden";

export type UkmaErrorKind = "forbidden" | "staff" | "down" | "unset" | "other";

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

export const errorStatus = (error: unknown): number | undefined =>
	axios.isAxiosError(error) ? error.response?.status : undefined;

export function ukmaErrorKind(error: unknown): UkmaErrorKind {
	switch (errorStatus(error)) {
		case 403:
			return responseCode(error) === UKMA_DATA_FORBIDDEN
				? "forbidden"
				: "staff";
		case 502:
			return "down";
		case 503:
			return "unset";
		default:
			return "other";
	}
}

export interface ErrorCopy {
	title: string;
	description: string | null;
	retry: boolean;
}

export const STAFF_ONLY = {
	title: "Розділ лише для суперкористувачів",
	description: "Попросіть адміністратора Rate UKMA, якщо вам потрібен доступ.",
} as const;

export function errorCopy(kind: UkmaErrorKind, title: string): ErrorCopy {
	switch (kind) {
		case "forbidden":
			return {
				title: "Немає доступу до цих даних",
				description:
					"У сайту немає дозволу бачити цей розділ. Зверніться до розробників.",
				retry: false,
			};
		case "staff":
			return { ...STAFF_ONLY, retry: false };
		case "down":
			return {
				title: "Дані САЗ зараз недоступні",
				description:
					"Сервіс САЗ не дав правильної відповіді. Спробуйте трохи згодом.",
				retry: true,
			};
		case "unset":
			return {
				title: "Доступ до даних САЗ не налаштовано",
				description:
					"Серверу бракує адреси або ключа доступу до даних САЗ. Зверніться до адміністратора.",
				retry: false,
			};
		case "other":
			return { title, description: null, retry: true };
	}
}

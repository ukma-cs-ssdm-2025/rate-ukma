import axios from "axios";
import { env } from "@/env";

export const authorizedHttpClient = axios.create({
	withCredentials: true,
	baseURL: env.VITE_API_BASE_URL,
});

export const authorizedFetcher = <TData>(
	config: Parameters<typeof authorizedHttpClient.request<TData>>[0],
) => {
	return authorizedHttpClient.request<TData>(config);
};

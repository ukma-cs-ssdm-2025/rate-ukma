import { useAuth } from "@/lib/auth/useAuth";
import { useSentryUser } from "./useSentryUser";

export function SentryUserSync() {
	const { user } = useAuth();
	useSentryUser(user);
	return null;
}

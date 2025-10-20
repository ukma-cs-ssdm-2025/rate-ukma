import { useContext } from "react";

import type { AuthStatus, AuthUser } from "./AuthContext";
import { AuthContext } from "./AuthContext";

export function useAuth() {
	const context = useContext(AuthContext);
	if (!context) {
		throw new Error("useAuth must be used within an AuthProvider");
	}
	return context;
}

export type { AuthUser, AuthStatus };

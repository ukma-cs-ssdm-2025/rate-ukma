/** An email as a stable opaque id: the first 16 hex chars of its SHA-256. */
export const opaqueId = async (email: string): Promise<string> => {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(email.trim().toLowerCase()),
	);
	return Array.from(new Uint8Array(digest, 0, 8), (byte) =>
		byte.toString(16).padStart(2, "0"),
	).join("");
};

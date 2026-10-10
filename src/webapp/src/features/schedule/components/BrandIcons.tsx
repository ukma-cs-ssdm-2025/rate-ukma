/** Brand glyphs in their own geometry and colours, at menu size. */

/** Google Calendar (2020 mark): the blue frame, coloured edges, «31» inside. */
export function GoogleCalendarIcon({
	className = "size-4",
}: {
	className?: string;
}) {
	return (
		<svg viewBox="0 0 200 200" className={className} aria-hidden="true">
			<path fill="#fff" d="M152.6 47.4H47.4v105.2h105.2z" />
			<path fill="#ea4335" d="M152.6 200l47.4-47.4h-47.4z" />
			<path fill="#fbbc04" d="M200 47.4h-47.4v105.2H200z" />
			<path fill="#34a853" d="M152.6 152.6H47.4V200h105.2z" />
			<path fill="#188038" d="M0 152.6v31.6C0 193 7 200 15.8 200h31.6v-47.4z" />
			<path fill="#1967d2" d="M200 47.4V15.8C200 7 193 0 184.2 0h-31.6v47.4z" />
			<path
				fill="#4285f4"
				d="M152.6 0H15.8C7 0 0 7 0 15.8v136.8h47.4V47.4h105.2z"
			/>
			<path
				fill="#4285f4"
				d="M69 129c-4-2.7-6.7-6.6-8-11.7l9-3.7c.8 3.1 2.2 5.5 4.2 7.2 2 1.7 4.4 2.5 7.2 2.5 2.9 0 5.3-.9 7.4-2.7 2.1-1.8 3.1-4.1 3.1-6.8 0-2.8-1.1-5.2-3.3-6.9-2.2-1.8-4.9-2.7-8.2-2.7h-5.2v-8.9h4.7c2.8 0 5.2-.8 7.1-2.3 1.9-1.5 2.9-3.6 2.9-6.3 0-2.4-.9-4.3-2.6-5.7-1.7-1.4-3.9-2.1-6.6-2.1-2.6 0-4.7.7-6.2 2.1-1.5 1.4-2.7 3.2-3.3 5.2l-8.9-3.7c1.2-3.3 3.3-6.3 6.5-8.8 3.2-2.5 7.2-3.8 12.1-3.8 3.6 0 6.9.7 9.8 2.1 2.9 1.4 5.2 3.3 6.8 5.8 1.6 2.5 2.4 5.3 2.4 8.4 0 3.2-.8 5.9-2.3 8.1-1.5 2.2-3.4 3.9-5.7 5v.5c2.9 1.2 5.4 3.1 7.3 5.6 1.9 2.5 2.9 5.5 2.9 9 0 3.5-.9 6.6-2.7 9.4-1.8 2.8-4.2 4.9-7.4 6.5-3.1 1.6-6.7 2.4-10.6 2.4-4.6 0-8.8-1.3-12.7-4zM124 79.6l-9.8 7.1-4.9-7.5 17.6-12.7h6.8v60h-9.7z"
			/>
		</svg>
	);
}

/** Microsoft's four squares, as on the sign-in button. */
export function MicrosoftIcon({
	className = "size-4",
}: {
	className?: string;
}) {
	return (
		<svg viewBox="0 0 21 21" className={className} aria-hidden="true">
			<rect x="0" y="0" width="10" height="10" fill="#f25022" />
			<rect x="11" y="0" width="10" height="10" fill="#7fba00" />
			<rect x="0" y="11" width="10" height="10" fill="#00a4ef" />
			<rect x="11" y="11" width="10" height="10" fill="#ffb900" />
		</svg>
	);
}

/** Apple's mark, monochrome in the text colour as Apple asks. */
export function AppleIcon({ className = "size-4" }: { className?: string }) {
	return (
		<svg
			viewBox="0 0 24 24"
			className={className}
			fill="currentColor"
			aria-hidden="true"
		>
			<path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
		</svg>
	);
}

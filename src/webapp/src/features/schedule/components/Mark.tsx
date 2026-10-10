/** The app mark: staggered day-bars, one of them yours. One hue — it inherits
 *  the surrounding text color; kept in step with public/favicon.svg. */
export function Mark({ className = "size-6" }: { className?: string }) {
	return (
		<svg
			viewBox="0 0 24 24"
			aria-hidden="true"
			className={className}
			fill="currentColor"
		>
			<rect x="3" y="8" width="4" height="8" rx="2" opacity="0.45" />
			<rect x="10" y="4" width="4" height="6.5" rx="2" opacity="0.45" />
			<rect x="10" y="12" width="4" height="8" rx="2" />
			<rect x="17" y="6.5" width="4" height="9.5" rx="2" opacity="0.45" />
		</svg>
	);
}

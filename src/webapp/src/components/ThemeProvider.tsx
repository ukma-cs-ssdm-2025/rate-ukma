import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";

export type Theme = "dark" | "light" | "system";

type ThemeProviderProps = {
	children: React.ReactNode;
	defaultTheme?: Theme;
	storageKey?: string;
};

type ThemeProviderState = {
	theme: Theme;
	setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
	theme: "system",
	setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

const SYSTEM_THEME_QUERY = "(prefers-color-scheme: dark)";

function isTheme(value: string | null): value is Theme {
	return value === "dark" || value === "light" || value === "system";
}

function resolveSystemTheme(): "dark" | "light" {
	return globalThis.matchMedia(SYSTEM_THEME_QUERY).matches ? "dark" : "light";
}

export function ThemeProvider({
	children,
	defaultTheme = "system",
	storageKey = "rate-ukma-theme",
	...props
}: Readonly<ThemeProviderProps>) {
	const [theme, setThemeState] = useState<Theme>(() => {
		const stored = localStorage.getItem(storageKey);
		return isTheme(stored) ? stored : defaultTheme;
	});
	const [systemTheme, setSystemTheme] = useState<"dark" | "light">(
		resolveSystemTheme,
	);

	// Follow the OS theme while "System" is selected so the switch is instant.
	useEffect(() => {
		const mediaQuery = globalThis.matchMedia(SYSTEM_THEME_QUERY);
		const handleChange = (event: MediaQueryListEvent) => {
			setSystemTheme(event.matches ? "dark" : "light");
		};
		mediaQuery.addEventListener("change", handleChange);
		return () => mediaQuery.removeEventListener("change", handleChange);
	}, []);

	useEffect(() => {
		const root = globalThis.document.documentElement;

		root.classList.remove("light", "dark");
		root.classList.add(theme === "system" ? systemTheme : theme);
	}, [theme, systemTheme]);

	const setTheme = useCallback(
		(newTheme: Theme) => {
			if (!isTheme(newTheme)) return;
			localStorage.setItem(storageKey, newTheme);
			setThemeState(newTheme);
		},
		[storageKey],
	);

	const value = useMemo(
		() => ({
			theme,
			setTheme,
		}),
		[theme, setTheme],
	);

	return (
		<ThemeProviderContext.Provider {...props} value={value}>
			{children}
		</ThemeProviderContext.Provider>
	);
}

export const useTheme = () => {
	const context = useContext(ThemeProviderContext);

	if (context === undefined)
		throw new Error("useTheme must be used within a ThemeProvider");

	return context;
};

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";

type Theme = "dark" | "light" | "system";

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

function isTheme(value: string | null): value is Theme {
	return value === "dark" || value === "light" || value === "system";
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

	// CSS resolves "system" via prefers-color-scheme (see styles.css), so only
	// an explicit pick is written to <html>; OS changes need no JS.
	useEffect(() => {
		const root = globalThis.document.documentElement;
		if (theme === "system") {
			delete root.dataset.colorScheme;
		} else {
			root.dataset.colorScheme = theme;
		}
	}, [theme]);

	const setTheme = useCallback(
		(newTheme: Theme) => {
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

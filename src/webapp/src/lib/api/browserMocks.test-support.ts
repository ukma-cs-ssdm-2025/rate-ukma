import { vi } from "vitest";

const DEFAULT_LOCATION = {
	pathname: "/",
	search: "",
	hash: "",
	origin: "http://localhost:3000",
} as const;

type LocationOverrides = Partial<Window["location"]>;

export const stubBrowserLocation = (overrides: LocationOverrides = {}) => {
	const replace = vi.fn();
	const locationStub = {
		...DEFAULT_LOCATION,
		replace,
		...overrides,
	};

	vi.stubGlobal("window", { location: locationStub });
	vi.stubGlobal("location", locationStub);

	return { locationStub, replace };
};

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Instructor } from "@/lib/api/generated";
import { renderWithProviders } from "@/test-utils/render";
import {
	formatInstructorLabel,
	InstructorMultiSelect,
} from "./InstructorMultiSelect";

// Mock the orval-generated infinite query hook backing the dropdown
vi.mock("@/lib/api/generated", async () => {
	const actual = await vi.importActual("@/lib/api/generated");
	return {
		...actual,
		useInstructorsListInfinite: vi.fn(),
	};
});

const { useInstructorsListInfinite } = await import("@/lib/api/generated");
const mockedInfinite = vi.mocked(useInstructorsListInfinite);

function createMockInstructor(overrides: Partial<Instructor> = {}): Instructor {
	return {
		id: "instructor-1",
		first_name: "Іван",
		last_name: "Іваненко",
		email: "ivan@ukma.edu.ua",
		...overrides,
	};
}

function mockInstructors(items: Instructor[]) {
	mockedInfinite.mockReturnValue({
		data:
			items.length > 0
				? {
						pages: [{ items, total: items.length, next_page: null }],
						pageParams: [],
					}
				: undefined,
		fetchNextPage: vi.fn(),
		hasNextPage: false,
		isFetchingNextPage: false,
		isLoading: false,
	} as unknown as ReturnType<typeof useInstructorsListInfinite>);
}

beforeEach(() => {
	vi.clearAllMocks();
	mockInstructors([]);
	// cmdk scrolls the active item into view; jsdom lacks this API
	Element.prototype.scrollIntoView = vi.fn();
});

describe("formatInstructorLabel", () => {
	it("should order last, first, then patronymic", () => {
		const label = formatInstructorLabel(
			createMockInstructor({
				last_name: "Іваненко",
				first_name: "Іван",
				patronymic: "Петрович",
			}),
		);
		expect(label).toBe("Іваненко Іван Петрович");
	});

	it("should omit a missing patronymic", () => {
		const label = formatInstructorLabel(
			createMockInstructor({
				last_name: "Іваненко",
				first_name: "Іван",
				patronymic: undefined,
			}),
		);
		expect(label).toBe("Іваненко Іван");
	});

	it("should filter out blank name parts", () => {
		const label = formatInstructorLabel({
			id: "x",
			last_name: "",
			first_name: "Іван",
			email: "x@ukma.edu.ua",
		});
		expect(label).toBe("Іван");
	});
});

describe("InstructorMultiSelect", () => {
	describe("Selected Chips", () => {
		it("should render a chip for each selected instructor", () => {
			// Arrange
			const selected = createMockInstructor({
				id: "instructor-1",
				last_name: "Іваненко",
				first_name: "Іван",
			});

			// Act
			renderWithProviders(
				<InstructorMultiSelect
					value={["instructor-1"]}
					onChange={vi.fn()}
					initialOptions={[selected]}
				/>,
			);

			// Assert
			expect(screen.getByText("Іваненко Іван")).toBeInTheDocument();
		});

		it("should show the placeholder when nothing is selected", () => {
			// Act
			renderWithProviders(
				<InstructorMultiSelect
					value={[]}
					onChange={vi.fn()}
					placeholder="Обрати викладача…"
				/>,
			);

			// Assert
			expect(screen.getByText("Обрати викладача…")).toBeInTheDocument();
		});

		it("should call onChange without the removed id when a chip is removed", async () => {
			// Arrange
			const user = userEvent.setup();
			const onChange = vi.fn();
			const a = createMockInstructor({ id: "a", last_name: "Алексенко" });
			const b = createMockInstructor({ id: "b", last_name: "Борисенко" });

			renderWithProviders(
				<InstructorMultiSelect
					value={["a", "b"]}
					onChange={onChange}
					initialOptions={[a, b]}
				/>,
			);

			// Act
			const removeButton = screen.getByRole("button", {
				name: /Видалити Алексенко/,
			});
			await user.click(removeButton);

			// Assert
			expect(onChange).toHaveBeenCalledWith(["b"]);
		});
	});

	describe("Option Toggling", () => {
		it("should add an option when toggled on", async () => {
			// Arrange
			const user = userEvent.setup();
			const onChange = vi.fn();
			const option = createMockInstructor({ id: "a", last_name: "Алексенко" });
			mockInstructors([option]);

			renderWithProviders(
				<InstructorMultiSelect
					value={[]}
					onChange={onChange}
					data-testid="instructor-select"
				/>,
			);

			// Act: open the dropdown then click the option
			await user.click(screen.getByRole("combobox"));
			const list = await screen.findByTestId("instructor-select-list");
			await user.click(within(list).getByText("Алексенко Іван"));

			// Assert
			expect(onChange).toHaveBeenCalledWith(["a"]);
		});

		it("should remove an already-selected option when toggled off", async () => {
			// Arrange
			const user = userEvent.setup();
			const onChange = vi.fn();
			const option = createMockInstructor({ id: "a", last_name: "Алексенко" });
			mockInstructors([option]);

			renderWithProviders(
				<InstructorMultiSelect
					value={["a"]}
					onChange={onChange}
					initialOptions={[option]}
					data-testid="instructor-select"
				/>,
			);

			// Act
			await user.click(screen.getByRole("combobox"));
			const list = await screen.findByTestId("instructor-select-list");
			await user.click(within(list).getByText("Алексенко Іван"));

			// Assert
			expect(onChange).toHaveBeenCalledWith([]);
		});
	});

	describe("maxSelected", () => {
		it("should not add beyond the cap", async () => {
			// Arrange
			const user = userEvent.setup();
			const onChange = vi.fn();
			const a = createMockInstructor({ id: "a", last_name: "Алексенко" });
			const b = createMockInstructor({ id: "b", last_name: "Борисенко" });
			mockInstructors([a, b]);

			renderWithProviders(
				<InstructorMultiSelect
					value={["a"]}
					onChange={onChange}
					initialOptions={[a]}
					maxSelected={1}
					data-testid="instructor-select"
				/>,
			);

			// Act: try to add a second option while at the cap
			await user.click(screen.getByRole("combobox"));
			const list = await screen.findByTestId("instructor-select-list");
			await user.click(within(list).getByText("Борисенко Іван"));

			// Assert
			expect(onChange).not.toHaveBeenCalled();
		});

		it("should still allow deselecting at the cap", async () => {
			// Arrange
			const user = userEvent.setup();
			const onChange = vi.fn();
			const a = createMockInstructor({ id: "a", last_name: "Алексенко" });
			mockInstructors([a]);

			renderWithProviders(
				<InstructorMultiSelect
					value={["a"]}
					onChange={onChange}
					initialOptions={[a]}
					maxSelected={1}
					data-testid="instructor-select"
				/>,
			);

			// Act
			await user.click(screen.getByRole("combobox"));
			const list = await screen.findByTestId("instructor-select-list");
			await user.click(within(list).getByText("Алексенко Іван"));

			// Assert
			expect(onChange).toHaveBeenCalledWith([]);
		});
	});
});

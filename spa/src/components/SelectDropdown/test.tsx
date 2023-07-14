import { render, screen } from "@testing-library/react";
import SelectDropdown from "./index";

test("Basic check for the select dropdown", async () => {
	render(
		<SelectDropdown
			onChange={jest.fn()}
			isLoading={false}
			options={[
				{ label: "First", value: "1" },
				{ label: "Second", value: "2" },
				{ label: "Third", value: "3" },
			]}
			label="Dropdown label"
			placeholder="Dropdown placeholder"
			icon={<span data-testId="selectIconId">🎉</span>}
		/>
	);

	expect(screen.queryByText("Dropdown label")).toBeInTheDocument();
	expect(screen.queryByText("Dropdown placeholder")).toBeInTheDocument();
	expect(screen.queryByTestId("selectIconId")).toBeInTheDocument();
});

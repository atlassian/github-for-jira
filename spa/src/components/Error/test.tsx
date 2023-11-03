import { render, screen } from "@testing-library/react";
import Error from "./index";

test("Basic test for errors", async () => {
	render(<Error type="error" message="BOOM! Warming the boiled egg in the microwave!!" />);

	expect(screen.queryByText("BOOM! Warming the boiled egg in the microwave!!")).toBeInTheDocument();
	expect(screen.queryByLabelText("warning")).toBeInTheDocument();
});

test("Basic test for warnings", async () => {
	render(<Error type="warning" message={<div>Warning! Do not warm the boiled egg in the microwave!</div>} />);

	expect(screen.queryByText("Warning! Do not warm the boiled egg in the microwave!")).toBeInTheDocument();
	expect(screen.queryByLabelText("warning")).toBeInTheDocument();
});

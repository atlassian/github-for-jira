import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import App from './App';

/**
 * This is a test case for the dummy component
 * TODO: Remove this dummy component test case and add the actual ones
 */
test('Testing the dummy component', async () => {
	render(<App />);
	expect(screen.queryByText("count is 0")).toBeTruthy();

	await userEvent.click(screen.getByText('Click'));

	expect(screen.queryByText("count is 0")).toBeNull();
	expect(screen.queryByText("count is 1")).toBeTruthy();

	await userEvent.click(screen.getByText('Click'));

	expect(screen.queryByText("count is 0")).toBeNull();
	expect(screen.queryByText("count is 1")).toBeNull();
	expect(screen.queryByText("count is 2")).toBeTruthy();
});

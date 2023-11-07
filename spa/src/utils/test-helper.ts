import { act, screen, fireEvent } from "@testing-library/react";

export function expectUserNotLogin() {
	expect(screen.queryByText("Select your GitHub product", { exact: false })).toBeInTheDocument();
	expect(screen.queryByText("Logged in as", { exact: false })).not.toBeInTheDocument();
}

export function expectUserLoginSuccess(login: string) {
	expect(screen.queryByText("Select your GitHub product")).not.toBeInTheDocument();
	expect(screen.queryByText("Change GitHub login")).toBeInTheDocument();
	expect(screen.queryByText("Logged in as", { exact: false })).toBeInTheDocument();
	expect(screen.queryByText(login)).toBeInTheDocument();
}

export function expectPopupWith(url: string, target: string) {
	expect((global as any).open).toHaveBeenLastCalledWith(url, target);
}

export function setupGlobalAP() {
	(global as any).AP = {
		getLocation: jest.fn(),
		context: {
			getContext: jest.fn(),
			getToken: jest.fn().mockImplementation((cb: (token: string) => void) => cb("some-token"))
		},
		navigator: {
			go: jest.fn(),
			reload: jest.fn()
		}
	};
	(global as any).open = jest.fn().mockReturnValue({
		closed: false
	});
}

export async function postMessage(data: any) {
	await act(async () => {
		fireEvent(window, new MessageEvent("message", {
			bubbles: true,
			origin: window.location.origin,
			data
		}));
	});
}

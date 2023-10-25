/** @jsxImportSource @emotion/react */
import Button from "@atlaskit/button";
import { css } from "@emotion/react";
import { popup } from "../utils";
import analyticsClient from "../analytics";
import OAuthManager from "../services/oauth-manager";

const loggedInContentStyle = css`
	display: flex;
	align-items: center;
	justify-content: center;
	margin: 0 auto;
`;
const buttonStyle = css`
	padding-left: 0;
`;

const LoggedinInfo = ({ username, logout, onPopupBlocked }: {
	username: string;
	logout: () => void;
	onPopupBlocked: () => void;
}) => {
	const clicked = () => {
		// Opens the popup for logging out of GitHub
		const win = popup("https://github.com/logout");
		if (win === null) {
			onPopupBlocked();
		}
		// Clearing the locally stored tokens
		OAuthManager.clear();
		// Passed callbacks, for re-rendering/changing states
		logout();
		analyticsClient.sendUIEvent({ actionSubject: "switchGitHubAccount", action: "clicked" });
	};

	return (
		<div css={loggedInContentStyle}>
			<div data-testid="logged-in-as">
				Logged in as <b>{username}</b>.&nbsp;
			</div>
			<Button css={buttonStyle} appearance="link" onClick={clicked}>
				Change GitHub login
			</Button>
		</div>
	);
};

export default LoggedinInfo;

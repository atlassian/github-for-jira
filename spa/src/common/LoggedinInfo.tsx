import Button from "@atlaskit/button";
import styled from "@emotion/styled";
import { popup } from "../utils";
import analyticsClient from "../analytics";
import OAuthManager from "../services/oauth-manager";

const LoggedInContent = styled.div`
	display: flex;
	align-items: center;
	justify-content: center;
	margin: 0 auto;
`;

const LoggedinInfo = ({ username, logout }: { username: string; logout: () => void;}) => {
	const clicked = () => {
		// Opens the popup for logging out of GitHub
		popup("https://github.com/logout");
		// Clearing the locally stored tokens
		OAuthManager.clear();
		// Passed callbacks, for re-rendering/changing states
		logout();
		analyticsClient.sendUIEvent({ actionSubject: "switchGitHubAccount", action: "clicked" });
	};

	return <LoggedInContent>
		<div data-testid="logged-in-as">Logged in as <b>{username}</b>.&nbsp;</div>
		<Button style={{ paddingLeft: 0 }} appearance="link" onClick={clicked}>Change GitHub login</Button>
	</LoggedInContent>;
};

export default LoggedinInfo;

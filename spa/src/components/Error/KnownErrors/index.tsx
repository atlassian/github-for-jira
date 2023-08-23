import styled from "@emotion/styled";
import { token } from "@atlaskit/tokens";
import { popup } from "../../../utils";
import Button from "@atlaskit/button";
import analyticsClient from "../../../analytics";

const Paragraph = styled.div`
	color: ${token("color.text.subtle")};
`;
const BulletSeparator = styled.span`
	padding: 0 ${token("space.100")};
`;
const StyledLink = styled.a`
	cursor: pointer;
`;

/************************************************************************
 * UI view for the 3 known errors
 *
 * These error components are used for 2 case scenarios:
 * 1. When displaying the error below an org within the list of orgs
 * 2. When displaying the error at the top banner after a user action.
 * `orgName` is present for the second case when there is a user action (like clicking the Connect button),
 *
 ************************************************************************/
export const ErrorForSSO = ({ orgName, accessUrl, resetCallback }: { orgName?: string; accessUrl: string; resetCallback: () => void;}) => {
	if (orgName) {
		analyticsClient.sendUIEvent({ actionSubject: "facedSSOLoginError", action: "clicked" }, { type: "cloud" });
	} else {
		analyticsClient.sendScreenEvent({ name: "OrganisationConnectionScreenWithSSOLoginError" }, { type: "cloud" });
	}

	return <>
		<Paragraph>
			Can't connect, single sign-on(SSO) required{orgName && <span> for <b>{orgName}</b></span>}.
		</Paragraph>
		<Paragraph>
			1. <StyledLink onClick={() => popup(accessUrl)}>Log into GitHub with SSO</StyledLink>.
		</Paragraph>
		<Paragraph>
			2. <StyledLink onClick={resetCallback}>Retry connection in Jira</StyledLink> (once logged in).
		</Paragraph>
	</>;
};

export const ErrorForNonAdmins = ({ orgName }: { orgName?: string; }) => {
	if (orgName) {
		analyticsClient.sendUIEvent({ actionSubject: "facedGithubNonAdminError", action: "clicked" }, { type: "cloud" });
	} else {
		analyticsClient.sendScreenEvent({ name: "OrganisationConnectionScreenWithGithubNonAdminError" }, { type: "cloud" });
	}
	return <Paragraph>
		Can't connect, you're not the organization owner{orgName && <span> of <b>{orgName}</b></span>}.<br />Ask an owner to complete this step.
	</Paragraph>;
};

export const ErrorForIPBlocked = ({ orgName, resetCallback }: { orgName?: string; resetCallback: () => void }) => {
	if (orgName) {
		analyticsClient.sendUIEvent({ actionSubject: "facedGitHubIPBlockedError", action: "clicked" }, { type: "cloud" });
	} else {
		analyticsClient.sendScreenEvent({ name: "OrganisationConnectionScreenWithGitHubIPBlockedError" }, { type: "cloud" });
	}
	return <>
		<Paragraph>
			Can't connect{orgName && <span> to <b>{orgName}</b></span>}, blocked by your IP allow list.
		</Paragraph>
		<Button
			style={{ paddingLeft: 0, paddingRight: 0 }}
			appearance="link"
			onClick={() => popup("https://github.com/atlassian/github-for-jira/blob/main/docs/ip-allowlist.md")}
		>
			How to update allowlist
		</Button>
		<BulletSeparator>&#8226;</BulletSeparator>
		<StyledLink onClick={resetCallback}>Retry</StyledLink>
	</>;
};

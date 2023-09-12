import styled from "@emotion/styled";
import { css } from "@emotion/react";
import { token } from "@atlaskit/tokens";
import Button from "@atlaskit/button";
import analyticsClient from "../../../analytics";
import { popup } from "../../../utils";

const paragraphStyle = css`
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
 ************************************************************************/
export const ErrorForSSO = ({ orgName, accessUrl, resetCallback }: { orgName?: string; accessUrl: string; resetCallback: () => void;}) => <>
	<div css={paragraphStyle}>
		Can't connect, single sign-on(SSO) required{orgName && <span> for <b>{orgName}</b></span>}.
	</div>
	<div css={paragraphStyle}>
		1. <StyledLink onClick={() => popup(accessUrl)}>Log into GitHub with SSO</StyledLink>.
	</div>
	<div css={paragraphStyle}>
		2. <StyledLink onClick={resetCallback}>Retry connection in Jira</StyledLink> (once logged in).
	</div>
</>;

export const ErrorForNonAdmins = ({ orgName, adminOrgsUrl }: { orgName?: string; adminOrgsUrl: string; }) => <div css={paragraphStyle}>
	Can't connect, you're not the organization owner{orgName && <span> of <b>{orgName}</b></span>}.<br />
	Ask an <StyledLink onClick={() => {
	// TODO: Need to get this URL for Enterprise users too, this is only for Cloud users
		popup(adminOrgsUrl);
		analyticsClient.sendUIEvent({ actionSubject: "checkOrgAdmin", action: "clicked"}, { type: "cloud" });
	}}>organization owner</StyledLink> to complete this step.
</div>;

export const ErrorForIPBlocked = ({ orgName, resetCallback }: { orgName?: string; resetCallback: () => void }) => <>
	<div css={paragraphStyle}>
		Can't connect{orgName && <span> to <b>{orgName}</b></span>}, blocked by your IP allow list.
	</div>
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

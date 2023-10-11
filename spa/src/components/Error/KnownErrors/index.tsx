/** @jsxImportSource @emotion/react */
import { css } from "@emotion/react";
import { token } from "@atlaskit/tokens";
import analyticsClient from "../../../analytics";
import { popup } from "../../../utils";

const paragraphStyle = css`
	color: ${token("color.text.subtle")};
`;
const bulletSeparatorStyle = css`
	padding: 0 ${token("space.100")};
`;
const linkStyle = css`
	cursor: pointer;
	padding-left: 0;
	padding-right: 0;
`;

/************************************************************************
 * UI view for the 3 known errors
 ************************************************************************/
export const ErrorForSSO = ({ orgName, accessUrl, resetCallback, onPopupBlocked }: {
	orgName?: string;
	accessUrl: string;
	resetCallback: () => void;
	onPopupBlocked: () => void;
}) => <>
	<div css={paragraphStyle}>
		Can't connect, single sign-on(SSO) required{orgName && <span> for <b>{orgName}</b></span>}.
	</div>
	<div css={paragraphStyle}>
		1. <a css={linkStyle} onClick={() => {
			const win = popup(accessUrl);
			if (win === null) onPopupBlocked();
		}}>Log into GitHub with SSO</a>.
	</div>
	<div css={paragraphStyle}>
		2. <a css={linkStyle} onClick={resetCallback}>Retry connection in Jira</a> (once logged in).
	</div>
</>;

export const ErrorForNonAdmins = ({ orgName, adminOrgsUrl }: { orgName?: string; adminOrgsUrl: string; }) => <div css={paragraphStyle}>
	Can't connect, you're not the organization owner{orgName && <span> of <b>{orgName}</b></span>}.<br />
	Ask an <a css={linkStyle} onClick={() => {
	// TODO: Need to get this URL for Enterprise users too, this is only for Cloud users
		popup(adminOrgsUrl);
		analyticsClient.sendUIEvent({ actionSubject: "checkOrgAdmin", action: "clicked"}, { type: "cloud" });
	}}>organization owner</a> to complete this step.
</div>;

export const ErrorForPopupBlocked = ({ onDismiss }: { onDismiss: () => void }) => (
	<>
		<div css={paragraphStyle}>
			Your browser stopped a pop-up window from opening. Allow pop-ups and try
			again. <a css={linkStyle} onClick={onDismiss}>Dismiss</a>
		</div>
	</>
);
export const ErrorForIPBlocked = ({ orgName, resetCallback }: { orgName?: string; resetCallback: () => void }) => <>
	<div css={paragraphStyle}>
		Can't connect{orgName && <span> to <b>{orgName}</b></span>}, blocked by your IP allow list.
	</div>
	<a
		css={linkStyle}
		onClick={() =>
			popup(
				"https://github.com/atlassian/github-for-jira/blob/main/docs/ip-allowlist.md"
			)
		}
	>
				How to update allowlist
	</a>
	<span css={bulletSeparatorStyle}>&#8226;</span>
	<a css={linkStyle} onClick={resetCallback}>Retry</a>
</>;

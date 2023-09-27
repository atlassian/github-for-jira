/** @jsxImportSource @emotion/react */
import { css } from "@emotion/react";
import { token } from "@atlaskit/tokens";
import analyticsClient from "../../../analytics";
import { popup } from "../../../utils";
import Api from "../../..//api";
import { DeferredInstallationUrlParams } from "../../../rest-interfaces";

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
export const ErrorForSSO = ({ orgName, accessUrl, resetCallback }: { orgName?: string; accessUrl: string; resetCallback: () => void;}) => <>
	<div css={paragraphStyle}>
		Can't connect, single sign-on(SSO) required{orgName && <span> for <b>{orgName}</b></span>}.
	</div>
	<div css={paragraphStyle}>
		1. <a css={linkStyle} onClick={() => popup(accessUrl)}>Log into GitHub with SSO</a>.
	</div>
	<div css={paragraphStyle}>
		2. <a css={linkStyle} onClick={resetCallback}>Retry connection in Jira</a> (once logged in).
	</div>
</>;

export const ErrorForNonAdmins = ({ orgName, adminOrgsUrl, deferredInstallationOrgDetails }: {
	orgName?: string;
	adminOrgsUrl: string;
	deferredInstallationOrgDetails: DeferredInstallationUrlParams;
}) => {
	const getOrgOwnerUrl = async () => {
		// TODO: Need to get this URL for Enterprise users too, this is only for Cloud users
		popup(adminOrgsUrl);
		analyticsClient.sendUIEvent({ actionSubject: "checkOrgAdmin", action: "clicked"}, { type: "cloud" });
	};
	const getDeferredInstallationUrl = async () => {
		const response= await Api.app.getDeferredInstallationUrl({
			gitHubInstallationId: deferredInstallationOrgDetails?.gitHubInstallationId ,
			gitHubOrgName: deferredInstallationOrgDetails?.gitHubOrgName
		});
		console.log("Fetched the URL", response.data.deferredInstallUrl);
		// TODO: Create events in amplitude
		analyticsClient.sendUIEvent({ actionSubject: "deferredInstallUrl", action: "clicked"});
	};

	return (
		<div css={paragraphStyle}>
			Can't connect, you're not the organization owner{orgName && <span> of <b>{orgName}</b></span>}.<br />
			Ask an <a css={linkStyle} onClick={getOrgOwnerUrl}>organization owner</a> to complete this step.<br />
			{
				// TODO: This will change later once the new designs are finalized
				deferredInstallationOrgDetails?.gitHubOrgName && <>
					Or send <a css={linkStyle} onClick={getDeferredInstallationUrl}>this link</a>.
				</>
			}
		</div>
	);
};

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

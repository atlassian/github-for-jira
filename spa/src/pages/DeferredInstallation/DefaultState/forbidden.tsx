/** @jsxImportSource @emotion/react */
import Step from "../../../components/Step";
import { css } from "@emotion/react";
import { token } from "@atlaskit/tokens";
import { popup } from "../../../utils";
import analyticsClient from "../../../analytics";

const paragraphStyle = css`
	color: ${token("color.text.subtle")};
	margin: ${token("space.0")};
`;
const noAdminDivStyle = css`
	margin-top: ${token("space.200")};
`;
const linkStyle = css`
	cursor: pointer;
	padding-left: 0;
	padding-right: 0;
`;

const ForbiddenState = ({ orgName, requestId } : { orgName: string; requestId: string; }) => {
	const getOrgOwnerUrl = async () => {
		// TODO: Need to get this URL for Enterprise users too, this is only for Cloud users
		popup(`https://github.com/orgs/${orgName}/people?query=role%3Aowner`);
		analyticsClient.sendUIEvent({ actionSubject: "checkOrgAdmin", action: "clicked"}, { type: "cloud", from: "DeferredInstallationFailedScreen" }, requestId);
	};

	return (
		<Step title="Can’t connect this organization because you don’t have owner permissions">
			<div css={noAdminDivStyle}>
				<p css={paragraphStyle}>
					The GitHub account you’ve used doesn’t have owner permissions
					for organization {orgName}.
				</p>
				<br/>
				<p css={paragraphStyle}>
					Let the person who sent you the request know to{" "}
					<a css={linkStyle} onClick={getOrgOwnerUrl}>
						find an owner for that organization.
					</a>
				</p>
			</div>
		</Step>
	);
};

export default ForbiddenState;

/** @jsxImportSource @emotion/react */
import Step from "../../../components/Step";
import { css } from "@emotion/react";
import { token } from "@atlaskit/tokens";
import { Wrapper } from "../../../common/Wrapper";
import SyncHeader from "../../../components/SyncHeader";
import { useLocation } from "react-router-dom";
import analyticsClient from "../../../analytics";

const paragraphStyle = css`
	color: ${token("color.text.subtle")};
	margin: ${token("space.0")};
`;
const noAdminDivStyle = css`
	margin-top: ${token("space.200")};
`;

const ForbiddenState = () => {
	const location = useLocation();
	const { requestId } = location.state;
	analyticsClient.sendScreenEvent({ name: "DeferredInstallationForbiddenScreen"}, { type: "cloud" }, requestId);

	return (
		<Wrapper hideClosedBtn={true}>
			<SyncHeader />
			<Step title="Can’t connect this organization because you don’t have owner permissions">
				<div css={noAdminDivStyle}>
					<p css={paragraphStyle}>
						The GitHub account you’ve used doesn’t have owner permissions <br/>
						to connect to the GitHub organization.
					</p>
					<br/>
					<p css={paragraphStyle}>
						Let the person who sent you the request know to <br/>
						find an owner for that organization.
					</p>
				</div>
			</Step>
		</Wrapper>
	);
};

export default ForbiddenState;

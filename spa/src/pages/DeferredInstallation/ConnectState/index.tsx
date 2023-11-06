/** @jsxImportSource @emotion/react */
import { Box, xcss } from "@atlaskit/primitives";
import InfoIcon from "@atlaskit/icon/glyph/info";
import Button from "@atlaskit/button";
import { css } from "@emotion/react";
import { token } from "@atlaskit/tokens";
import Step from "../../../components/Step";
import { useState } from "react";
import { AxiosError } from "axios";
import DeferralManager from "../../../services/deferral-manager";
import analyticsClient from "../../../analytics";
import { useLocation, useNavigate } from "react-router-dom";
import { Wrapper } from "../../../common/Wrapper";
import SyncHeader from "../../../components/SyncHeader";
import SkeletonForLoading from "../../../pages/ConfigSteps/SkeletonForLoading";

const boxStyles = xcss({
	borderBlockWidth: token("space.500"),
	borderStyle: "solid",
	borderColor: "color.border",
	borderRadius: "border.radius.050",
	borderWidth: "border.width",
	marginTop: token("space.200"),
	marginBottom: token("space.200"),
	display: "flex",
	alignItems: "center",
});
const paragraphStyle = css`
	color: ${token("color.text.subtle")};
	margin: ${token("space.0")};
`;
const infoParaStyle = css`
	padding-left: 16px;
`;

const ConnectState = () => {
	const location = useLocation();
	const { orgName, jiraHost, requestId } = location.state;

	const navigate = useNavigate();
	const [isLoading, setIsLoading] = useState<boolean>(false);

	const connectDeferredOrgOrg = async () => {
		if (requestId) {
			analyticsClient.sendUIEvent(
				{ actionSubject: "connectOrganisation", action: "clicked" },
				{ mode: "manual", from: "DeferredInstallation" },
				requestId
			);
			setIsLoading(true);
			const status: boolean | AxiosError = await DeferralManager.connectOrgByDeferral(requestId);
			if (status instanceof AxiosError) {
				navigate("forbidden", { state: { requestId } });
			} else if (status) {
				navigate("/spa/connected", { state: { orgLogin: orgName, requestId } });
			} else {
				navigate("forbidden", { state: { requestId } });
			}
			setIsLoading(false);
		}
	};

	return (
		<Wrapper hideClosedBtn={true}>
			<SyncHeader />
			{
				isLoading ? <SkeletonForLoading /> : <Step
					title={`Connect GitHub organization ${orgName} to Jira Software`}
				>
					<>
						<p css={paragraphStyle}>
							A Jira administrator has asked for approval to connect the
							GitHub organization {orgName} to the Jira site {jiraHost}.
						</p>
						<Box padding="space.200" xcss={boxStyles}>
							<InfoIcon label="differed-installation-info" size="small"/>
							<p css={[paragraphStyle, infoParaStyle]}>
								This will make all repositories in {orgName} available to all projects in {jiraHost}. Import work from those
								GitHub repositories into Jira.
							</p>
						</Box>
						<Button appearance="primary" onClick={connectDeferredOrgOrg}>
							Connect
						</Button>
					</>
				</Step>
			}
		</Wrapper>
	);
};

export default ConnectState;

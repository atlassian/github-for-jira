/** @jsxImportSource @emotion/react */
import { Box, xcss } from "@atlaskit/primitives";
import InfoIcon from "@atlaskit/icon/glyph/info";
import Button from "@atlaskit/button";
import { css } from "@emotion/react";
import { token } from "@atlaskit/tokens";
import Step from "../../../components/Step";
import { useEffect, useState } from "react";
import { AxiosError } from "axios";
import OAuthManager from "../../../services/oauth-manager";
import DeferralManager from "../../../services/deferral-manager";
import analyticsClient from "../../../analytics";
import { useNavigate } from "react-router-dom";

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

const DefaultState = ({
	orgName,
	jiraHost,
	requestId,
	callbacks,
}: {
	orgName: string;
	jiraHost: string;
	requestId: string;
	callbacks: any;
}) => {
	const navigate = useNavigate();
	const { setIsLoading, setForbidden, onPopupBlocked } = callbacks;
	const [isLoggedIn, setIsLoggedIn] = useState(false);

	// Finish the OAuth dance if authenticated
	useEffect(() => {
		const handler = async (event: MessageEvent) => {
			if (event.data?.type === "oauth-callback" && event.data?.code) {
				const response: boolean | AxiosError = await OAuthManager.finishOAuthFlow(event.data?.code, event.data?.state);
				setIsLoading(false);
				if (response instanceof AxiosError) {
					return;
				}
				setIsLoggedIn(true);
			}
		};
		window.addEventListener("message", handler);
		return () => {
			window.removeEventListener("message", handler);
		};
	}, []);

	// Start the deferral connection if authenticated
	useEffect(() => {
		const connectDeferredOrgOrg = async () => {
			if (requestId) {
				setIsLoading(true);
				const status: boolean | AxiosError = await DeferralManager.connectOrgByDeferral(requestId);
				if (status instanceof AxiosError) {
					setForbidden(true);
					analyticsClient.sendScreenEvent({ name: "DeferredInstallationFailedScreen" }, { type: "cloud" }, requestId);
				}
				else if (status) {
					setForbidden(false);
					navigate("/spa/connected",{ state: { orgLogin: orgName, requestId } });
				} else {
					setForbidden(true);
				}
				setIsLoading(false);
			}
		};

		isLoggedIn && connectDeferredOrgOrg();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ isLoggedIn ]);

	// Authenticate if no token/username is set
	const authenticate = async () => {
		setIsLoading(true);
		try {
			analyticsClient.sendUIEvent({ actionSubject: "signInAndConnectThroughDeferredInstallationStartScreen", action: "clicked"}, { type: "cloud" }, requestId);
			await OAuthManager.authenticateInGitHub({
				onWinClosed: () => {
					setIsLoading(false);
				}, onPopupBlocked
			});
		} catch (e) {
			// TODO: print alert error
			console.error("check error", e);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<Step
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
				<Button appearance="primary" onClick={authenticate}>
					Sign in & connect
				</Button>
			</>
		</Step>
	);
};

export default DefaultState;

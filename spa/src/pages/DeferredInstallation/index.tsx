/** @jsxImportSource @emotion/react */
import { useSearchParams, useNavigate } from "react-router-dom";
import InfoIcon from "@atlaskit/icon/glyph/info";
import { Wrapper } from "../../common/Wrapper";
import Step from "../../components/Step";
import SyncHeader from "../../components/SyncHeader";
import OAuthManager from "../../services/oauth-manager";
import { css } from "@emotion/react";
import { Box, xcss } from "@atlaskit/primitives";
import SkeletonForLoading from "../ConfigSteps/SkeletonForLoading";
import { token } from "@atlaskit/tokens";
import Button from "@atlaskit/button";
import { useEffect, useState } from "react";
import { AxiosError } from "axios";
import { ErrorObjType, modifyError } from "../../utils/modifyError";
import ErrorUI from "../../components/Error";
import analyticsClient from "../../analytics";
import { popup } from "../../utils";
import { ErrorForPopupBlocked } from "../../components/Error/KnownErrors";
import DeferralManager from "../../services/deferral-manager";

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
const noAdminDivStyle = css`
	margin-top: ${token("space.200")};
`;
const infoParaStyle = css`
	padding-left: 16px;
`;
const linkStyle = css`
	cursor: pointer;
	padding-left: 0;
	padding-right: 0;
`;


const DeferredInstallation = () => {
	const [searchParams] = useSearchParams();
	const requestId = searchParams.get("requestId") || "";
	const navigate = useNavigate();
	const username = OAuthManager.getUserDetails().username || "";

	const [isPopupBlocked, setPopupBlocked] = useState<boolean>(false);
	const onPopupBlocked = () => setPopupBlocked(true);

	const [isLoading, setIsLoading] = useState(false);
	const [isLoggedIn, setIsLoggedIn] = useState(false);
	const [error, setError] = useState<ErrorObjType | undefined>(undefined);

	const [jiraHost, setJiraHost] = useState("");
	const [orgName, setOrgName] = useState("");

	const [forbidden, setForbidden] = useState(false);

	// Extract the info from the requestId
	useEffect(() => {
		const extractFromRequestId = async () => {
			const extractedPayload = await DeferralManager.extractFromRequestId(requestId);
			if (extractedPayload instanceof AxiosError) {
				setError(modifyError(
					{ errorCode: "INVALID_DEFERRAL_REQUEST_ID"},
					{},
					{ onClearGitHubToken: () => {}, onRelogin: () => {}, onPopupBlocked }
				));
				setIsLoading(true);
			} else {
				setJiraHost(extractedPayload.jiraHost as string);
				setOrgName(extractedPayload.orgName);
			}
		};
		extractFromRequestId();
	}, [ requestId ]);

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

	// Set the token/username after authentication
	useEffect(() => {
		const connectDeferredOrgOrg = async () => {
			if (requestId) {
				setIsLoading(true);
				const status: boolean | AxiosError = await DeferralManager.connectOrgByDeferral(requestId);
				if (status instanceof AxiosError) {
					setForbidden(true);
				}
				else if (status) {
					console.log("Successfully connected now navigate");
					setForbidden(false);
					navigate("/spa/connected",{ state: { orgLogin: orgName, connectedByDeferral: true } });
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
			await OAuthManager.authenticateInGitHub({
				onWinClosed: () => {
					setIsLoading(false);
					console.log("Successfully authenticated", username);
				}, onPopupBlocked
			});
		} catch (e) {
			// TODO: print alert error
			console.log("check error", e);
		} finally {
			setIsLoading(false);
		}
	};

	const getOrgOwnerUrl = async () => {
		// TODO: Need to get this URL for Enterprise users too, this is only for Cloud users
		popup(`https://github.com/orgs/${orgName}/people?query=role%3Aowner`);
		analyticsClient.sendUIEvent({ actionSubject: "checkOrgAdmin", action: "clicked"}, { type: "cloud" });
	};
	// TODO: orgname is not appearing for all the cases, need to check
	return (
		<Wrapper hideClosedBtn={true}>
			<SyncHeader />
			{isPopupBlocked && (
				<ErrorUI
					type={"error"}
					message={<ErrorForPopupBlocked onDismiss={() => setPopupBlocked(false)}/>}
				/>
			)}
			{error && <ErrorUI type={error.type} message={error.message} />}

			{
				isLoading ? <SkeletonForLoading /> : <>
					{
						forbidden ? (
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
						) : (
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
										<p css={[paragraphStyle,infoParaStyle]}>
											This will make all repositories in {orgName} available to all projects in {jiraHost}. Import work from those GitHub repositories into Jira.
										</p>
									</Box>
									<Button appearance="primary" onClick={authenticate}>
										Sign in & connect
									</Button>
								</>
							</Step>
						)
					}
				</>
			}
		</Wrapper>
	);
};

export default DeferredInstallation;

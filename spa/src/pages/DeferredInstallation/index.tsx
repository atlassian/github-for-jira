/** @jsxImportSource @emotion/react */
import { useNavigate, useSearchParams } from "react-router-dom";
import { Wrapper } from "../../common/Wrapper";
import SyncHeader from "../../components/SyncHeader";
import SkeletonForLoading from "../ConfigSteps/SkeletonForLoading";
import { useEffect, useState } from "react";
import { AxiosError } from "axios";
import ErrorUI from "../../components/Error";
import analyticsClient from "../../analytics";
import { ErrorForPopupBlocked } from "../../components/Error/KnownErrors";
import Step from "../../components/Step";
import Button from "@atlaskit/button";
import { css } from "@emotion/react";
import { token } from "@atlaskit/tokens";
import OAuthManager from "../../services/oauth-manager";
import DeferralManager from "../../services/deferral-manager";
import { modifyError } from "../../utils/modifyError";

const paragraphStyle = css`
	color: ${token("color.text.subtle")};
	margin: ${token("space.0")} ${token("space.0")} ${token("space.250")} ;
`;
const DeferredInstallation = () => {
	const [searchParams] = useSearchParams();
	const requestId = searchParams.get("requestId") || "";
	const navigate = useNavigate();

	const [isPopupBlocked, setPopupBlocked] = useState<boolean>(false);
	const onPopupBlocked = () => setPopupBlocked(true);
	const [isLoading, setIsLoading] = useState(false);

	useEffect(() => {
		const handler = async (event: MessageEvent) => {
			if (event.data?.type === "oauth-callback" && event.data?.code) {
				const response: boolean | AxiosError = await OAuthManager.finishOAuthFlow(event.data?.code, event.data?.state);
				if (response instanceof AxiosError) {
					console.error("Error: ", response);
					return;
				}
				parseRequestId();
			}
		};
		window.addEventListener("message", handler);
		return () => {
			window.removeEventListener("message", handler);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const authenticate = async () => {
		setIsLoading(true);
		try {
			analyticsClient.sendUIEvent({ actionSubject: "signInAndConnectThroughDeferredInstallationStartScreen", action: "clicked"}, { type: "cloud" }, requestId);
			await OAuthManager.authenticateInGitHub({
				onWinClosed: () => {},
				onPopupBlocked
			});
		} catch (e) {
			// TODO: print alert error
			console.error("check error", e);
		}
	};

	const parseRequestId = async () => {
		const extractedPayload = await DeferralManager.extractFromRequestId(requestId);
		setIsLoading(false);
		if (extractedPayload instanceof AxiosError) {
			if (extractedPayload.response?.status === 403) {
				navigate("forbidden", { state: { requestId } });
			} else {
				navigate("error", {
					state: {
						error: modifyError(
							{ errorCode: "INVALID_DEFERRAL_REQUEST_ID"},
							{},
							{ onClearGitHubToken: () => {}, onRelogin: () => {}, onPopupBlocked }
						)
					}
				});
			}
		} else {
			navigate("connect", {
				state: {
					orgName: extractedPayload.orgName,
					jiraHost: extractedPayload.jiraHost,
					requestId
				}
			});
		}
	};

	return (
		<Wrapper hideClosedBtn={true}>
			<SyncHeader />
			{isPopupBlocked && (
				<ErrorUI
					type={"error"}
					message={<ErrorForPopupBlocked onDismiss={() => setPopupBlocked(false)}/>}
				/>
			)}

			{
				isLoading ? <SkeletonForLoading /> : <Step
					title={"Connect a GitHub organization to Jira Software"}
				>
					<>
						<p css={paragraphStyle}>
							A Jira administrator has asked for approval to connect a GitHub
							organization to a Jira site.
						</p>

						<Button appearance="primary" onClick={authenticate}>
							Sign in
						</Button>
					</>
				</Step>
			}
		</Wrapper>
	);
};

export default DeferredInstallation;

/** @jsxImportSource @emotion/react */
import { useSearchParams } from "react-router-dom";
import { Wrapper } from "../../common/Wrapper";
import SyncHeader from "../../components/SyncHeader";
import SkeletonForLoading from "../ConfigSteps/SkeletonForLoading";
import { useEffect, useState } from "react";
import { AxiosError } from "axios";
import { ErrorObjType, modifyError } from "../../utils/modifyError";
import ErrorUI from "../../components/Error";
import analyticsClient from "../../analytics";
import { ErrorForPopupBlocked } from "../../components/Error/KnownErrors";
import DeferralManager from "../../services/deferral-manager";
import ErrorState from "./ErrorState";
import DefaultState from "./DefaultState";
import ForbiddenState from "./DefaultState/forbidden";

const DeferredInstallation = () => {
	const [searchParams] = useSearchParams();
	const requestId = searchParams.get("requestId") || "";
	const [jiraHost, setJiraHost] = useState("");
	const [orgName, setOrgName] = useState("");

	const [isPopupBlocked, setPopupBlocked] = useState<boolean>(false);
	const onPopupBlocked = () => setPopupBlocked(true);

	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<ErrorObjType | undefined>(undefined);
	const [forbidden, setForbidden] = useState(false);

	// Extract the info from the requestId
	useEffect(() => {
		const extractFromRequestId = async () => {
			const extractedPayload = await DeferralManager.extractFromRequestId(requestId);
			if (extractedPayload instanceof AxiosError) {
				// TODO: Need a new UI for this scenario
				setError(modifyError(
					{ errorCode: "INVALID_DEFERRAL_REQUEST_ID"},
					{},
					{ onClearGitHubToken: () => {}, onRelogin: () => {}, onPopupBlocked }
				));
			} else {
				setJiraHost(extractedPayload.jiraHost as string);
				setOrgName(extractedPayload.orgName);
				analyticsClient.sendScreenEvent({ name: "DeferredInstallationStartScreen" }, { type: "cloud" }, requestId);
			}
		};
		extractFromRequestId();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

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
				error ? <ErrorState error={error} /> :
				<>
					{
						isLoading ? <SkeletonForLoading /> : <>
							{
								forbidden ? <ForbiddenState orgName={orgName} requestId={requestId} /> :
									<DefaultState
										orgName={orgName}
										jiraHost={jiraHost}
										requestId={requestId}
										callbacks={{ setIsLoading, setForbidden, onPopupBlocked }}
									/>
							}
						</>
					}
				</>
			}
		</Wrapper>
	);
};

export default DeferredInstallation;

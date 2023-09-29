/** @jsxImportSource @emotion/react */
import { useState } from "react";
import { css } from "@emotion/react";
import { token } from "@atlaskit/tokens";
import analyticsClient from "../../../analytics";
import { popup } from "../../../utils";
import Api from "../../../api";
import { DeferredInstallationUrlParams } from "../../../rest-interfaces";
import Modal, {
	ModalBody,
	ModalFooter,
	ModalHeader,
	ModalTitle,
	ModalTransition,
} from "@atlaskit/modal-dialog";
import Spinner from "@atlaskit/spinner";
import Button from "@atlaskit/button";

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
	const [isOpen, setIsOpen] = useState<boolean>(false);
	const [isLoading, setIsLoading] = useState<boolean>(false);
	const [deferredInstallationUrl, setDeferredInstallationUrl] = useState<string | null>(null);

	const getOrgOwnerUrl = async () => {
		// TODO: Need to get this URL for Enterprise users too, this is only for Cloud users
		popup(adminOrgsUrl);
		analyticsClient.sendUIEvent({ actionSubject: "checkOrgAdmin", action: "clicked"}, { type: "cloud" });
	};

	const getDeferredInstallationUrl = async () => {
		if (!isOpen) {
			try {
				setIsOpen(true);
				setIsLoading(true);
				const response = await Api.app.getDeferredInstallationUrl({
					gitHubInstallationId: deferredInstallationOrgDetails?.gitHubInstallationId ,
					gitHubOrgName: deferredInstallationOrgDetails?.gitHubOrgName
				});
				setDeferredInstallationUrl(response.data.deferredInstallUrl);
				// TODO: Create events in amplitude
			} catch(e) {
				console.error("Could not fetch the deferred installation url: ", e);
			} finally {
				setIsLoading(false);
			}
		}
	};

	const closeModal = () => {
		setIsOpen(false);
		setDeferredInstallationUrl(null);
	};

	return (
		<div css={paragraphStyle}>
			Can't connect, you're not the organization owner{orgName && <span> of <b>{orgName}</b></span>}.<br />
			Ask an <a css={linkStyle} onClick={getOrgOwnerUrl}>organization owner</a> to complete this step <br />
			{
				deferredInstallationOrgDetails?.gitHubOrgName && <>
					or send a link to them by <a css={linkStyle} onClick={getDeferredInstallationUrl}>clicking here</a>.
				</>
			}
			<ModalTransition>
				{
					isOpen &&
						<Modal onClose={closeModal}>
							{
								isLoading ? <Spinner interactionName="load" /> : <>
									<ModalHeader>
										<ModalTitle>
											Send this URL to Github admin:
										</ModalTitle>
									</ModalHeader>
									<ModalBody>
										<b>{deferredInstallationUrl}</b>
									</ModalBody>
									<ModalFooter>
										<Button appearance="warning" onClick={closeModal} autoFocus>
											Got it!
										</Button>
									</ModalFooter>
								</>
							}
						</Modal>
				}
			</ModalTransition>
		</div>
	);
};

export const ErrorForPopupBlocked = () => (
	<>
		<div css={paragraphStyle}>
			Your browser is blocking pop-ups. Enable pop-ups for this site and select{" "}
			<b>Next</b> again.
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

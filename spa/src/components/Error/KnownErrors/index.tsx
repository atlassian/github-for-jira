/** @jsxImportSource @emotion/react */
import { useState } from "react";
import { css } from "@emotion/react";
import { token } from "@atlaskit/tokens";
import analyticsClient from "../../../analytics";
import { popup } from "../../../utils";
import { DeferredInstallationUrlParams } from "rest-interfaces";
import { HostUrlType } from "../../../utils/modifyError";
import Api from "../../../api";
import Modal, {
	ModalBody,
	ModalFooter,
	ModalHeader,
	ModalTitle,
	ModalTransition,
} from "@atlaskit/modal-dialog";
import TextArea from "@atlaskit/textarea";
import Spinner from "@atlaskit/spinner";
import Button from "@atlaskit/button";

const olStyle = css`
	padding-left: 1.2em;
`;
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
const textAreaStyle = css`
	margin-top: 20px;
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

export const ErrorForNonAdmins = ({ orgName, adminOrgsUrl, onPopupBlocked, deferredInstallationOrgDetails , hostUrl}: {
	orgName?: string;
	adminOrgsUrl: string;
	onPopupBlocked: () => void;
	deferredInstallationOrgDetails: DeferredInstallationUrlParams;
	hostUrl?: HostUrlType;
}) => {
	const [isOpen, setIsOpen] = useState<boolean>(false);
	const [isLoading, setIsLoading] = useState<boolean>(false);
	const [deferredInstallationUrl, setDeferredInstallationUrl] = useState<string | null>(null);

	const getOrgOwnerUrl = async () => {
		// TODO: Need to get this URL for Enterprise users too, this is only for Cloud users
		const win = popup(adminOrgsUrl);
		if (win === null) onPopupBlocked();
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
				// TODO: handle this error in UI/Modal ?
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
			You’re not an owner for this organization. To connect:
			<ol css={olStyle}>
				<li>
					<a css={linkStyle} onClick={getOrgOwnerUrl}>
						Find an organization owner.
					</a>
				</li>
				<li>
					<a css={linkStyle} onClick={getDeferredInstallationUrl}>
						Send them a link and ask them to connect.
					</a>
				</li>
			</ol>
			<ModalTransition>
				{isOpen && (
					<Modal onClose={closeModal}>
						{isLoading ? (
							<Spinner interactionName="load" />
						) : (
							<>
								<ModalHeader>
									<ModalTitle>Send a link to an organization owner</ModalTitle>
								</ModalHeader>
								<ModalBody>
									<div css={paragraphStyle}>
										Copy the message and URL below, and send it to an
										organization owner to approve.
										<br />
										<a css={linkStyle} onClick={getOrgOwnerUrl}>
											Find an organization owner
										</a>
									</div>
									<TextArea
										css={textAreaStyle}
										id="deffered-installation-msg"
										name="deffered-installation-msg"
										defaultValue={`I want to connect the GitHub organization ${orgName} to the Jira site ${hostUrl?.jiraHost}, and I need your approval as an organization owner.\n\nIf you approve, can you go to this link and complete the connection?\n\n${deferredInstallationUrl}`}
										readOnly
									/>
								</ModalBody>
								<ModalFooter>
									<Button appearance="primary" onClick={closeModal} autoFocus>
										Close
									</Button>
								</ModalFooter>
							</>
						)}
					</Modal>
				)}
			</ModalTransition>
		</div>
	);
};

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

import Button, { LoadingButton } from "@atlaskit/button";
import { GitHubInstallationType } from "../../../../../src/rest-interfaces";
import styled from "@emotion/styled";
import { token } from "@atlaskit/tokens";
import { useState } from "react";
import WarningIcon from "@atlaskit/icon/glyph/warning";
import { popup } from "../../../utils";
import OauthManager from "../../../services/oauth-manager";

type OrgDivType = {
	key: number;
	hasError: boolean;
};

const OrgsWrapper = styled.div`
	max-height: 250px;
	overflow-y: auto;
	padding-right: 80px;
	margin-right: -80px;
`;
const OrgDiv = styled.div<OrgDivType>`
	display: flex;
	justify-content: space-between;
	align-items: ${props => props.hasError ? "start" : "center"};
	padding: ${token("space.150")} 0;
	margin-bottom: ${token("space.100")};
`;
const OrgName = styled.span`
	color: ${token("color.text")};
	font-weight: 590;
`;
const Paragraph = styled.div`
	color: ${token("color.text.subtle")};
`;
const IconWrapper = styled.div`
	padding-top: ${token("space.150")};
`;
const BulletSeparator = styled.span`
	padding: 0 ${token("space.100")};
`;
const StyledLink = styled.a`
	cursor: pointer;
`;

const OrganizationsList = ({
	organizations,
	loaderForOrgClicked,
	setLoaderForOrgClicked,
	resetCallback,
	connectingOrg,
}: {
	organizations: Array<GitHubInstallationType>;
	// Passing down the states and methods from the parent component
	loaderForOrgClicked: boolean;
	setLoaderForOrgClicked: (args: boolean) => void;
	resetCallback: (args: boolean) => void;
	connectingOrg: (org: GitHubInstallationType) => void;
}) => {
	const [clickedOrg, setClickedOrg] = useState<GitHubInstallationType | undefined>(undefined);
	const canConnect = (org: GitHubInstallationType) => !org.requiresSsoLogin && !org.isIPBlocked && org.isAdmin;

	// This method clears the tokens and then re-authenticates
	const resetToken = async () => {
		await OauthManager.clear();
		// This resets the token validity check in the parent component and resets the UI
		resetCallback(false);
		// Restart the whole auth flow
		await OauthManager.authenticateInGitHub(() => {});
	};

	const errorMessage = (org: GitHubInstallationType) => {
		if (org.requiresSsoLogin) {
			// TODO: Update this to support GHE
			const accessUrl = `https://github.com/organizations/${org.account.login}/settings/profile`;

			return <>
				<Paragraph>
					Can't connect, single sign-on(SSO) required.
				</Paragraph>
				<Paragraph>
					1. <StyledLink onClick={() => popup(accessUrl)}>Log into GitHub with SSO</StyledLink>.
				</Paragraph>
				<Paragraph>
					2. <StyledLink onClick={resetToken}>Retry connection in Jira</StyledLink> (once logged in).
				</Paragraph>
			</>;
		}

		if (org.isIPBlocked) {
			return <>
				<Paragraph>
					Can't connect, blocked by your IP allow list.
				</Paragraph>
				<Button
					style={{ paddingLeft: 0, paddingRight: 0 }}
					appearance="link"
					onClick={() => popup("https://github.com/atlassian/github-for-jira/blob/main/docs/ip-allowlist.md")}
				>
					How to update allowlist
				</Button>
				<BulletSeparator>&#8226;</BulletSeparator>
				<StyledLink onClick={resetToken}>Retry</StyledLink>
			</>;
		}

		if (!org.isAdmin) {
			return <>
				<Paragraph>
					Can't connect, you're not an organization owner.<br />Ask an owner to complete this step.
				</Paragraph>
			</>;
		}
	};

	return (
		<OrgsWrapper>
			{
				organizations.map(org =>
					<OrgDiv key={org.id} hasError={!canConnect(org)}>
						{
							canConnect(org) ? <>
								<OrgName>{org.account.login}</OrgName>
								{
									loaderForOrgClicked && clickedOrg?.id === org.id ?
										<LoadingButton style={{width: 80}} isLoading>Loading button</LoadingButton> :
										<Button
											isDisabled={loaderForOrgClicked && clickedOrg?.id !== org.id}
											onClick={async () => {
												setLoaderForOrgClicked(true);
												setClickedOrg(org);
												try {
													// Calling the create connection function that is passed from the parent
													await connectingOrg(org);
												} finally {
													setLoaderForOrgClicked(false);
												}
											}}
										>
											Connect
										</Button>
								}
							</> : <>
								<div>
									<OrgName>{org.account.login}</OrgName>
									<div>{errorMessage(org)}</div>
								</div>
								<IconWrapper>
									<WarningIcon label="warning" primaryColor={token("color.background.warning.bold")} size="medium" />
								</IconWrapper>
							</>
						}
					</OrgDiv>
				)
			}
		</OrgsWrapper>
	);
};

export default OrganizationsList;

import Button, { LoadingButton } from "@atlaskit/button";
import { GitHubInstallationType } from "../../../../../src/rest-interfaces";
import styled from "@emotion/styled";
import { token } from "@atlaskit/tokens";
import { useState } from "react";
import WarningIcon from "@atlaskit/icon/glyph/warning";
import OauthManager from "../../../services/oauth-manager";
import { ErrorForIPBlocked, ErrorForNonAdmins, ErrorForSSO } from "../../../components/Error/KnownErrors";

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
const IconWrapper = styled.div`
	padding-top: ${token("space.150")};
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

			return <ErrorForSSO resetCallback={resetToken} accessUrl={accessUrl} />;
		}

		if (org.isIPBlocked) {
			return <ErrorForIPBlocked resetCallback={resetToken} />;
		}

		if (!org.isAdmin) {
			return <ErrorForNonAdmins />;
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

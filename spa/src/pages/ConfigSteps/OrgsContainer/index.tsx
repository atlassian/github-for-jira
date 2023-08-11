import Button, { LoadingButton } from "@atlaskit/button";
import { GitHubInstallationType } from "../../../../../src/rest-interfaces";
import styled from "@emotion/styled";
import { token } from "@atlaskit/tokens";
import { useState } from "react";

const OrgsWrapper = styled.div`
	max-height: 250px;
	overflow-y: auto;
	padding-right: 80px;
	margin-right: -80px;
`;
const OrgDiv = styled.div`
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: ${token("space.150")} 0;
	margin-bottom: ${token("space.100")};
`;

const OrganizationsList = ({
	organizations,
	loaderForOrgClicked,
	setLoaderForOrgClicked,
	connectingOrg,
}: {
	organizations: Array<GitHubInstallationType>;
	// Passing down the states and methods from the parent component
	loaderForOrgClicked: boolean;
	setLoaderForOrgClicked: (args: boolean) => void;
	connectingOrg: (org: GitHubInstallationType) => void;
}) => {
	const [clickedOrg, setClickedOrg] = useState<GitHubInstallationType | undefined>(undefined);

	return (
		<OrgsWrapper>
			{
				organizations.map(org =>
					<OrgDiv key={org.id}>
						<span>{org.account.login}</span>
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
					</OrgDiv>
				)
			}
		</OrgsWrapper>
	);
};

export default OrganizationsList;

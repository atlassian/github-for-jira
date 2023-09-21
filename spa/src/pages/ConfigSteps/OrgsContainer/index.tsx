/** @jsxImportSource @emotion/react */
import { useRef, useState, useEffect } from "react";
import Button, { LoadingButton } from "@atlaskit/button";
import { GitHubInstallationType } from "../../../../../src/rest-interfaces";
import { css } from "@emotion/react";
import { token } from "@atlaskit/tokens";
import WarningIcon from "@atlaskit/icon/glyph/warning";
import OauthManager from "../../../services/oauth-manager";
import { ErrorForIPBlocked, ErrorForNonAdmins, ErrorForSSO } from "../../../components/Error/KnownErrors";

const orgsWrapperStyle = css`
	max-height: 250px;
	overflow-y: auto;
	width: 100%;
`;
const orgDivStyle = css`
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: ${token("space.150")} 0;
	margin-bottom: ${token("space.100")};
`;

const orgDivWithErrorStyle = css`
	align-items: start;
`;

const orgNameStyle = css`
	color: ${token("color.text")};
	font-weight: 590;
`;
const iconWrapperStyle = css`
	padding-top: ${token("space.150")};
`;

const gradientStyle = css`
	background: linear-gradient(rgba(255, 255, 255, 0), rgb(255, 255, 255));
	height: 70px;
	margin-top: -70px;
	position: relative;
	width: 100%;
	display: block;
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
	const [isScrolledToBottom, setIsScrolledToBottom] = useState(false);
	const [isListScrollable, setIsListScrollable] = useState(false);
	const contentRef = useRef<HTMLDivElement | null>(null);
	const gradientRef = useRef<HTMLDivElement | null>(null);
	const hasScrolledYetRef = useRef(false);
	const [clickedOrg, setClickedOrg] = useState<
		GitHubInstallationType | undefined
	>(undefined);

	const canConnect = (org: GitHubInstallationType) =>
		!org.requiresSsoLogin && !org.isIPBlocked && org.isAdmin;

	const checkIsListScrollable = () => {
		let isListScrollable = false;
		const content = contentRef.current;
		console.log("i am in ",content);
		if (content) {
			const max = parseInt(window.getComputedStyle(content).maxHeight);
			const size = content.scrollHeight;
			console.log("i am in ", max, size);
			isListScrollable =  (size - 15) > max;

		}
		setIsListScrollable(isListScrollable);
	};

	const handleScroll = ()=> {
		const content = contentRef.current;
		hasScrolledYetRef.current = true;
		if (content) {
			const scrollTop = content.scrollTop;
			const scrollHeight = content.scrollHeight;
			const clientHeight = content.clientHeight;
			const scrolledToBottom = scrollTop + clientHeight === scrollHeight;
			setIsScrolledToBottom(scrolledToBottom);
		}
	};

	const handleGradientScroll = () =>{
		console.log("okokokok ");
	};

	useEffect(() => {
		const content = contentRef.current;
		const gradient = gradientRef.current;
		hasScrolledYetRef.current = false;
		if(gradient){
			gradient.addEventListener("scroll", handleGradientScroll);
		}
		if (content) {
			checkIsListScrollable();
			content.addEventListener("scroll", handleScroll);
		}
		return () => {
			if (content) {
				content.removeEventListener("scroll", handleScroll);
			}
			if(gradient){
				gradient.removeEventListener("scroll", handleGradientScroll);
			}
		};
	}, []);

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
			// TODO: Update this to support GHE
			const adminOrgsUrl = `https://github.com/orgs/${org.account.login}/people?query=role%3Aowner`;

			return <ErrorForNonAdmins adminOrgsUrl={adminOrgsUrl} />;
		}
	};
	return (
		<>
			<div css={orgsWrapperStyle} ref={contentRef}>
				{organizations.map((org) => {
					const hasError = !canConnect(org);
					const orgDivStyles = hasError
						? [orgDivStyle, orgDivWithErrorStyle]
						: [orgDivStyle];
					return (
						<div key={org.id} css={orgDivStyles}>
							{canConnect(org) ? (
								<>
									<span css={orgNameStyle}>{org.account.login}</span>
									{loaderForOrgClicked && clickedOrg?.id === org.id ? (
										<LoadingButton style={{ width: 80 }} isLoading>
											Loading button
										</LoadingButton>
									) : (
										<Button
											isDisabled={
												loaderForOrgClicked && clickedOrg?.id !== org.id
											}
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
									)}
								</>
							) : (
								<>
									<div>
										<span css={orgNameStyle}>{org.account.login}</span>
										<div>{errorMessage(org)}</div>
									</div>
									<div css={iconWrapperStyle}>
										<WarningIcon
											label="warning"
											primaryColor={token("color.background.warning.bold")}
											size="medium"
										/>
									</div>
								</>
							)}
						</div>
					);
				})}
			</div>
			{isListScrollable && (hasScrolledYetRef.current ? !isScrolledToBottom : true)  && <div ref={gradientRef} css={gradientStyle} />}
		</>
	);
};

export default OrganizationsList;

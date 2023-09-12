import styled from "@emotion/styled";
import { css } from "@emotion/react";
import { Wrapper } from "../../common/Wrapper";
import { token, useThemeObserver } from "@atlaskit/tokens";
import Heading from "@atlaskit/heading";
import Button from "@atlaskit/button";
import analyticsClient, { useEffectScreenEvent } from "../../analytics";
import { useNavigate } from "react-router-dom";

const connectedContainerStyle = css`
	margin: 0 auto;
	text-align: center;
`;
const HeaderImg = styled.img`
	height: 96px;
`;
const Title = styled.h2`
	margin: ${token("space.400")} ${token("space.0")} ${token("space.0")};
`;
const topContentStyle = css`
	color: ${token("color.text.subtle")};
	margin: ${token("space.300")} ${token("space.0")} ${token("space.100")};
`;
const paragraphStyle = css`
	color: ${token("color.text.subtle")};
	margin: ${token("space.300")} ${token("space.0")};
`;
const buttonContainerStyle = css`
	margin: ${token("space.0")} ${token("space.0")} ${token("space.300")} ${token("space.0")};
`;
const flexWrapperStyle = css`
	padding: ${token("space.300")} ${token("space.0")} ${token("space.0")};
	display: flex;
	justify-content: space-between;
	margin: 0 auto;
`;
const sectionStyle = css`
	background: ${token("elevation.surface.sunken")};
	border-radius: 3px;
	width: 300px;
	padding: ${token("space.200")} ${token("space.0")};
	&:first-of-type {
		margin-right: ${token("space.200")};
	}
`;
const SectionImg = styled.img`
	height: 100px;
`;

const Connected = () => {
	useEffectScreenEvent("SuccessfulConnectedScreen");

	const navigate = useNavigate();
	const { colorMode } = useThemeObserver();

	const navigateToBackfillPage = () => {
		analyticsClient.sendUIEvent({ actionSubject: "checkBackfillStatus", action: "clicked" });
		AP.navigator.go( "addonmodule", { moduleKey: "gh-addon-admin" });
	};

	return (<Wrapper>
		<div css={connectedContainerStyle}>
			<div>
				<HeaderImg src={colorMode === "dark" ? "/public/assets/jira-github-connected-dark-theme.svg" : "/public/assets/jira-github-connected.svg"} alt=""/>
				<Title>GitHub is connected!</Title>
				<div css={topContentStyle}>
					It’s time to let everyone know GitHub’s ready to use and your<br />
					team can use issue keys to link work to Jira.<br />
				</div>
				<div css={buttonContainerStyle}>
					<Button
						style={{ paddingLeft: 0 }}
						appearance="link"
						onClick={() => navigate("/spa/steps")}
					>
						Add another organization
					</Button>
				</div>
			</div>
			<div>
				<Heading level="h500">What's next?</Heading>
				<div css={flexWrapperStyle}>
					<div css={sectionStyle}>
						<SectionImg src="/public/assets/github-integration.svg" alt=""/>
						<Heading level="h400">Add issue keys in GitHub</Heading>
						<div css={paragraphStyle}>
							Include issue keys in pull request<br/>
							titles, commit messages and<br />
							more to bring them into Jira.
						</div>
						<a
							href="https://support.atlassian.com/jira-software-cloud/docs/reference-issues-in-your-development-work/"
							target="_blank"
						>
							Learn about issue linking
						</a>
					</div>
					<div css={sectionStyle}>
						<SectionImg src="/public/assets/collaborate-in-jira.svg" alt=""/>
						<Heading level="h400">Collaborate in Jira</Heading>
						<div css={paragraphStyle}>
							Your team's development work<br />
							will appear in issues and the<br />
							code feature.
						</div>
						<a
							href="https://support.atlassian.com/jira-cloud-administration/docs/integrate-with-development-tools/"
							target="_blank"
						>
							Learn about development work in Jira
						</a>
					</div>
				</div>
			</div>
			<div css={paragraphStyle}>
				We're backfilling your organization's repositories into Jira (this <br/>
				can take a while, depending on how many repositories you<br />
				have).
				<Button
					style={{ paddingLeft: 0, height: 14, lineHeight: "14px", display: "inline-flex" }}
					appearance="link"
					onClick={navigateToBackfillPage}
				>
					Check your backfill status
				</Button>.
			</div>
		</div>
	</Wrapper>);
};

export default Connected;

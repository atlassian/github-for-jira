import styled from "@emotion/styled";
import { Wrapper } from "../../common/Wrapper";
import { token, useThemeObserver } from "@atlaskit/tokens";
import Heading from "@atlaskit/heading";
import Button from "@atlaskit/button";
import analyticsClient, { useEffectScreenEvent } from "../../analytics";
import { useNavigate } from "react-router-dom";
import FrontendFeatureFlagClient from "../../frontend-feature-flag-client";

const ConnectedContainer = styled.div`
	margin: 0 auto;
	text-align: center;
`;
const HeaderImg = styled.img`
	height: 96px;
`;
const Title = styled.h2`
	margin: ${token("space.400")} ${token("space.0")} ${token("space.0")};
`;
const TopContent = styled.div`
	color: ${token("color.text.subtle")};
	margin: ${token("space.300")} ${token("space.0")} ${token("space.100")};
`;
const Paragraph = styled.div`
	color: ${token("color.text.subtle")};
	margin: ${token("space.300")} ${token("space.0")};
`;
const ButtonContainer = styled.div`
	margin: ${token("space.0")} ${token("space.0")} ${token("space.300")} ${token("space.0")};
`;
const FlexWrapper = styled.div`
	padding: ${token("space.300")} ${token("space.0")} ${token("space.0")};
	display: flex;
	justify-content: space-between;
	margin: 0 auto;
`;
const Section = styled.div`
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
	const enable5KuExperienceBackfillPage: boolean = new FrontendFeatureFlagClient().getFlagValue("enable-5ku-experience-backfill-page", true);

	const navigate = useNavigate();
	const { colorMode } = useThemeObserver();

	const navigateToBackfillPage = () => {
		analyticsClient.sendUIEvent({ actionSubject: "checkBackfillStatus", action: "clicked" });

		if (enable5KuExperienceBackfillPage) {
			navigate("/spa/connections");
		} else {
			AP.navigator.go( "addonmodule", { moduleKey: "gh-addon-admin" });
		}
	};

	return (<Wrapper>
		<ConnectedContainer>
			<div>
				<HeaderImg src={colorMode === "dark" ? "/public/assets/jira-github-connected-dark-theme.svg" : "/public/assets/jira-github-connected.svg"} alt=""/>
				<Title>GitHub is connected!</Title>
				<TopContent>
					It’s time to let everyone know GitHub’s ready to use and your<br />
					team can use issue keys to link work to Jira.<br />
				</TopContent>
				<ButtonContainer>
					<Button
						style={{ paddingLeft: 0 }}
						appearance="link"
						onClick={() => navigate("/spa/steps")}
					>
						Add another organization
					</Button>
				</ButtonContainer>
			</div>
			<div>
				<Heading level="h500">What's next?</Heading>
				<FlexWrapper>
					<Section>
						<SectionImg src="/public/assets/github-integration.svg" alt=""/>
						<Heading level="h400">Add issue keys in GitHub</Heading>
						<Paragraph>
							Include issue keys in pull request<br/>
							titles, commit messages and<br />
							more to bring them into Jira.
						</Paragraph>
						<a
							href="https://support.atlassian.com/jira-software-cloud/docs/reference-issues-in-your-development-work/"
							target="_blank"
						>
							Learn about issue linking
						</a>
					</Section>
					<Section>
						<SectionImg src="/public/assets/collaborate-in-jira.svg" alt=""/>
						<Heading level="h400">Collaborate in Jira</Heading>
						<Paragraph>
							Your team's development work<br />
							will appear in issues and the<br />
							code feature.
						</Paragraph>
						<a
							href="https://support.atlassian.com/jira-cloud-administration/docs/integrate-with-development-tools/"
							target="_blank"
						>
							Learn about development work in Jira
						</a>
					</Section>
				</FlexWrapper>
			</div>
			<Paragraph>
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
			</Paragraph>
		</ConnectedContainer>
	</Wrapper>);
};

export default Connected;

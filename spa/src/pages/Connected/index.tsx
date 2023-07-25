import styled from "@emotion/styled";
import { Wrapper } from "../../common/Wrapper";
import { token } from "@atlaskit/tokens";
import Button from "@atlaskit/button";
import analyticsClient, { useEffectScreenEvent } from "../../analytics";

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
const Paragraph = styled.div`
	color: ${token("color.text.subtle")};
	margin: ${token("space.300")} ${token("space.0")};
`;
const FlexWrapper = styled.div`
	padding: ${token("space.300")} ${token("space.0")} ${token("space.0")};
	display: flex;
	justify-content: space-between;
	width: 616px;
	margin: 0 auto;
`;
const Section = styled.div`
	background: ${token("elevation.surface.sunken")};
	border-radius: 3px;
	width: 100%;
	padding: ${token("space.200")} ${token("space.0")};
`;
const SectionImg = styled.img`
	height: 100px;
`;

const Connected = () => {

	useEffectScreenEvent("SuccessfulConnectedScreen");

	const navigateToBackfillPage = () => {
		analyticsClient.sendUIEvent({ actionSubject: "checkBackfillStatus", action: "clicked" });
		AP.navigator.go(
			"addonmodule",
			{
				moduleKey: "github-post-install-page"
			}
		);
	};

	return (<Wrapper>
		<ConnectedContainer>
			<div>
				<HeaderImg src="/spa-assets/jira-github-connection-success.svg" alt=""/>
				<Title>GitHub is connected!</Title>
				<Paragraph>
					Its' time to let everyone know that GitHub's ready to use in their<br />
					project. For development work to appear in Jira, your team<br />
					needs to link their work using issue keys.
				</Paragraph>
			</div>
			<div>
				<h5>What's next?</h5>
				<FlexWrapper>
					<Section>
						<SectionImg src="/spa-assets/github-integration.svg" alt=""/>
						<h4>Add issue keys in GitHub</h4>
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
						<SectionImg src="/spa-assets/collaborate-in-jira.svg" alt=""/>
						<h4>Collaborate in Jira</h4>
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
				We're backfilling your organization's repositories into Jira (this<br />
				can take a while, depending on how many repositories you<br />
				have). <Button style={{ paddingLeft: 0 }} appearance="link" onClick={navigateToBackfillPage}>Check your backfill status</Button>
			</Paragraph>
		</ConnectedContainer>
	</Wrapper>);
};

export default Connected;

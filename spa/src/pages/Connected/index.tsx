/** @jsxImportSource @emotion/react */
import { css } from "@emotion/react";
import { useLocation } from "react-router-dom";
import { Wrapper } from "../../common/Wrapper";
import { token, useThemeObserver } from "@atlaskit/tokens";
import Heading from "@atlaskit/heading";
import Button from "@atlaskit/button";
import analyticsClient, { useEffectScreenEvent } from "../../analytics";
import { useNavigate } from "react-router-dom";
import { enableBackfillStatusPage } from "./../../feature-flags";

const connectedContainerStyle = css`
	margin: 0 auto;
	text-align: center;
	width: 100%;
	min-height: 364px;
`;
const headerImgStyle = css`
	height: 96px;
`;
const titleStyle = css`
	margin: ${token("space.400")} ${token("space.0")} ${token("space.0")};
`;
const paragraphStyle = css`
	color: ${token("color.text.subtle")};
	margin: ${token("space.100")} ${token("space.0")} ${token("space.300")} ${token("space.0")};
	padding: 0px ${token("space.600")};
`;
const flexWrapperStyle = css`
	padding: ${token("space.400")} ${token("space.0")};
	display: flex;
	justify-content: space-between;
	margin: 0 auto;
`;
const sectionStyle = css`
	background: ${token("elevation.surface.sunken")};
	border-radius: 3px;
	width: 100%;
	padding: ${token("space.200")} ${token("space.0")};
	&:first-of-type {
		margin-right: ${token("space.200")};
	}
`;
const sectionImgStyle = css`
	height: 100px;
	margin-bottom: ${token("space.300")};
`;

const buttonStyle = css`
	margin: 0px 10px;
`;
const subtleBtnStyle = css`
	color: ${token("color.text.subtle")} !important;
`;
const Connected = () => {
	const location = useLocation();
	const { orgLogin, connectedByDeferral } = location.state;
	useEffectScreenEvent("SuccessfulConnectedScreen");

	const navigate = useNavigate();
	const { colorMode } = useThemeObserver();

	const navigateToBackfillPage = () => {
		analyticsClient.sendUIEvent({
			actionSubject: "checkBackfillStatus",
			action: "clicked",
		});

		if (enableBackfillStatusPage) {
			navigate("/spa/connections");
		} else {
			AP.navigator.go("addonmodule", { moduleKey: "gh-addon-admin" });
		}
	};

	const learnAboutIssueLinking = () => {
		analyticsClient.sendUIEvent({
			actionSubject: "learnAboutIssueLinking",
			action: "clicked",
		});
		window.open(
			"https://support.atlassian.com/jira-software-cloud/docs/reference-issues-in-your-development-work/",
			"_blank"
		);
	};

	return (
		<Wrapper insideIframe={!connectedByDeferral}>
			<div css={connectedContainerStyle}>
				<img
					css={headerImgStyle}
					src={
						colorMode === "dark"
							? "/public/assets/jira-github-connected-dark-theme.svg"
							: "/public/assets/jira-github-connected.svg"
					}
					alt=""
				/>
				<h2 css={titleStyle}>{`${orgLogin} is now connected!`}</h2>
				<div css={flexWrapperStyle}>
					<div css={sectionStyle}>
						<img
							css={sectionImgStyle}
							src="/public/assets/github-integration.svg"
							alt=""
						/>
						<Heading level="h400">
							Your team needs to add issue keys in GitHub
						</Heading>
						<div css={paragraphStyle}>
							To import development work into Jira and track it in your issues,
							add issue keys to branches, pull request titles, and commit
							messages.
						</div>
						{
							!connectedByDeferral && <Button
								css={[buttonStyle, subtleBtnStyle]}
								appearance="subtle"
								onClick={() => navigate("/spa/steps")}
							>
								Add another organization
							</Button>
						}
						<Button
							css={buttonStyle}
							appearance="primary"
							onClick={learnAboutIssueLinking}
						>
							How to add issue keys
						</Button>
					</div>
				</div>
				{
					!connectedByDeferral && <Button
						css={[buttonStyle, subtleBtnStyle]}
						appearance="subtle"
						onClick={navigateToBackfillPage}
					>
						Exit set up
					</Button>
				}
			</div>
		</Wrapper>
	);
};

export default Connected;

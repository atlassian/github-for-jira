/** @jsxImportSource @emotion/react */
import { useNavigate } from "react-router-dom";
import Button from "@atlaskit/button";
import ArrowRightIcon from "@atlaskit/icon/glyph/arrow-right";
import UserAvatarCircleIcon from "@atlaskit/icon/glyph/user-avatar-circle";
import UnlockFilledIcon from "@atlaskit/icon/glyph/unlock-filled";
import styled from "@emotion/styled";
import { css } from "@emotion/react";
import { token } from "@atlaskit/tokens";
import Tooltip, { TooltipPrimitive } from "@atlaskit/tooltip";
import SyncHeader from "../../components/SyncHeader";
import { Wrapper } from "../../common/Wrapper";
import analyticsClient, { useEffectScreenEvent } from "../../analytics";
import { reportError } from "../../utils";
import { enableBackfillStatusPage } from "./../../feature-flags";

const beforeTextStyle = css`
	color: ${token("color.text.subtle")};
	margin: 0 0 ${token("space.300")};
	text-align: center;
`;
const listContainerStyle = css`
	background: ${token("color.background.input.hovered")};
	max-width: 368px;
	padding: ${token("space.250")};
	border-radius: ${token("space.050")};
	margin: 0 auto;
`;
const listItemStyle = css`
	display: flex;
`;
const logoStyle = css`
	margin: ${token("space.025")} ${token("space.075")} 0 0;
`;
const buttonContainerStyle = css`
	text-align: center;
	margin: ${token("space.300")} 0 0;
	display: flex;
	flex-direction: column;
	align-items: center;
`;
const inlineDialogLinkStyle = css`
	cursor: pointer;
`;
const inlineDialogDivStyle = css`
	padding: ${token("space.200")} 0 0 ${token("space.150")};
`;
const inlineDialogImgContainerStyle = css`
	height: 180px;
	text-align: center;
	padding: ${token("space.200")} 0;
`;
const InlineDialog = styled(TooltipPrimitive)`
	background: white;
	border-radius: ${token("space.050")};
	box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
	box-sizing: content-box;
	padding: ${token("space.100")} ${token("space.150")};
	position: absolute;
	top: -22px;
`;

const GITHUB_CLOUD_ORG_SETTINGS_URL = "https://github.com/settings/organizations";

const InlineDialogContent = () => (
	<>
		<div css={inlineDialogDivStyle}>To check your GitHub permissions:</div>
		<ol>
			<li>Go to <a href={GITHUB_CLOUD_ORG_SETTINGS_URL} target="_blank">manage organizations</a></li>
			<li>Your permission level will be next to your organization name.</li>
		</ol>
		<div css={inlineDialogImgContainerStyle}>
			<img src="/public/assets/github-skeleton.svg" alt=""/>
		</div>
	</>
);

const getAnalyticsSourceFrom = (): string => {
	try {
		const url = new URL(window.location.href);
		return url.searchParams.get("from") || "";
	} catch (e: unknown) {
		reportError(new Error("Fail getAnalyticsSourceFrom", { cause: e }), { path: "getAnalyticsSourceFrom" });
		return "";
	}
};

const screenAnalyticsAttributes = { from: getAnalyticsSourceFrom() };

const StartConnection = () => {
	const navigate = useNavigate();

	useEffectScreenEvent("StartConnectionEntryScreen", screenAnalyticsAttributes);

	return (
		<Wrapper>
			<SyncHeader/>
			<div css={beforeTextStyle}>Before you start, you should have:</div>
			<div css={listContainerStyle}>
				<div css={listItemStyle}>
					<div css={logoStyle}>
						<UserAvatarCircleIcon label="github-account" size="small"/>
					</div>
					<span>A GitHub account</span>
				</div>
				<div css={listItemStyle}>
					<div css={logoStyle}>
						<UnlockFilledIcon label="owner-permission" size="small"/>
					</div>
					<div>
						<span>Owner permission for a GitHub organization</span><br/>
						<Tooltip
							component={InlineDialog}
							position="right-end"
							content={InlineDialogContent}
						>
							{(props) => <a css={inlineDialogLinkStyle} {...props}>Learn how to check GitHub permissions</a>}
						</Tooltip>
					</div>
				</div>
			</div>
			<div css={buttonContainerStyle}>
				<Button
					iconAfter={<ArrowRightIcon label="continue" size="medium"/>}
					appearance="primary"
					aria-label="continue"
					onClick={() => {
						analyticsClient.sendUIEvent({ actionSubject: "startToConnect", action: "clicked" });
						navigate("steps");
					}}
				>
					Continue
				</Button>
				{
					enableBackfillStatusPage &&
						<Button
							appearance="subtle"
							onClick={() => {
								navigate("/spa/connections");
							}}
						>
							Go to backfill page
						</Button>
				}
			</div>
		</Wrapper>
	);
};

export default StartConnection;

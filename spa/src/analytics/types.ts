type UIEventActionSubject =
	"startToConnect"
	| "authorizeTypeGitHubCloud" | "authorizeTypeGitHubEnt"
  | "startOAuthAuthorisation" | "switchGitHubAccount"
	| "connectOrganisation" | "installToNewOrganisation"
	| "checkBackfillStatus"
	| "dropExperienceViaBackButton"
	| "facedSSOLoginError" | "facedGitHubIPBlockedError" | "facedGithubNonAdminError";

export type UIEventProps = {
	actionSubject: UIEventActionSubject,
	action: "clicked"
};

export type ScreenNames =
	"StartConnectionEntryScreen"
  | "AuthorisationScreen"
	| "OrganisationConnectionScreen"
	| "OrganisationConnectionScreenWithSSOLoginError" | "OrganisationConnectionScreenWithGitHubIPBlockedError" | "OrganisationConnectionScreenWithGithubNonAdminError"
	| "SuccessfulConnectedScreen";

type TrackEventActionSubject =
	"finishOAuthFlow"
  | "organisationConnectResponse"
	| "installNewOrgInGithubResponse";

export type TrackEventProps = {
	actionSubject: TrackEventActionSubject,
	action: "success" | "fail"
};

export type ScreenEventProps = {
	name: ScreenNames
};

export type AnalyticClient = {
	sendScreenEvent: (eventProps: ScreenEventProps, attributes?: Record<string, unknown>) => void;
	sendUIEvent: (eventProps: UIEventProps, attributes?: Record<string, unknown>) => void;
	sendTrackEvent: (eventProps: TrackEventProps, attributes?: Record<string, unknown>) => void;
};


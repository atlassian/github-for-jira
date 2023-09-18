type UIEventActionSubject =
	"startToConnect"
	| "authorizeTypeGitHubCloud" | "authorizeTypeGitHubEnt"
  | "startOAuthAuthorisation" | "switchGitHubAccount"
	| "connectOrganisation" | "installToNewOrganisation"
	| "checkBackfillStatus"
	| "dropExperienceViaBackButton"
	| "checkOrgAdmin"
	| "learnAboutIssueLinking" | "learnAboutDevelopmentWork";

export type UIEventProps = {
	actionSubject: UIEventActionSubject,
	action: "clicked"
};

export type ScreenNames =
	"StartConnectionEntryScreen"
  | "AuthorisationScreen"
	| "OrganisationConnectionScreen"
	| "SuccessfulConnectedScreen";

type TrackEventActionSubject =
	"finishOAuthFlow"
  | "organizations"
  | "organisationConnectResponse"
	| "installNewOrgInGithubResponse";

export type TrackEventProps = {
	actionSubject: TrackEventActionSubject,
	action: "success" | "fail" | "fetched" | "requested";
};

export type ScreenEventProps = {
	name: ScreenNames
};

export type AnalyticClient = {
	sendScreenEvent: (eventProps: ScreenEventProps, attributes?: Record<string, unknown>) => void;
	sendUIEvent: (eventProps: UIEventProps, attributes?: Record<string, unknown>) => void;
	sendTrackEvent: (eventProps: TrackEventProps, attributes?: Record<string, unknown>) => void;
};


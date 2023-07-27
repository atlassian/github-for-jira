type UIEventActionSubject =
	"startToConnect"
	| "authorizeTypeGitHubCloud" | "authorizeTypeGitHubEnt"
  | "startOAuthAuthorisation" | "switchGitHubAccount"
	| "connectOrganisation" | "installToNewOrganisation"
	| "checkBackfillStatus";

export type UIEventOpts = {
	actionSubject: UIEventActionSubject,
	action: "clicked",
	attributes?: Record<string, string | number>
};

export type ScreenNames =
	"StartConnectionEntryScreen"
  | "AuthorisationScreen"
	| "OrganisationConnectionScreen"
	| "SuccessfulConnectedScreen";

type TrackEventActionSubject =
	"finishOAuthFlow"
  | "organisationConnectResponse"
	| "installNewOrgInGithubResponse";

export type TrackEventOpts = {
	actionSubject: TrackEventActionSubject,
	action: "success" | "fail",
	attributes?: Record<string, string | number>
};

export type ScreenEventOpts = {
	name: ScreenNames,
	attributes?: Record<string, string | number>
};

export type AnalyticClient = {
	sendScreenEvent: (event: ScreenEventOpts) => void;
	sendUIEvent: (event: UIEventOpts) => void;
	sendTrackEvent: (event: TrackEventOpts) => void;
};


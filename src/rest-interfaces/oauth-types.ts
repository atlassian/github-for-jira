export type GetRedirectUrlResponse = {
	redirectUrl: string;
	state: string;
};

export type ExchangeTokenResponse = {
	accessToken: string;
	refreshToken: string;
};

export type UsersGetAuthenticatedResponse = {
	email: string;
	login: string;
};

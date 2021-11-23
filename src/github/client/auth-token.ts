export const TEN_MINUTES = 10 * 60 * 1000;
export const ONE_MINUTE = 60 * 1000;

export default class AuthToken {
	readonly token: string;
	readonly expirationDate: Date;

	constructor(token: string, expirationDate: Date) {
		this.token = token;
		this.expirationDate = expirationDate;
	}

	isAboutToExpire(): boolean {
		return Date.now() + ONE_MINUTE > this.expirationDate.getTime();
	}

	millisUntilAboutToExpire() {
		return Math.max(this.expirationDate.getTime() - ONE_MINUTE - Date.now(), 0);
	}
}

/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable jest/no-standalone-expect */

import GithubAppClient from "../../../src/github/client/github-app-client";
import nock from "nock";

describe("GithubAppClient", () => {

	const githubInstallationId = 123456;
	const installationToken = "this is a secret token";
	const expirationDate = new Date();
	const privateKey = `-----BEGIN RSA PRIVATE KEY-----
MIIG5AIBAAKCAYEAyRPVyMQcKYq182ZNH7cx0/+FO0ftPiYkZcUQWoYXzkQzKMiN
433gRCIgdv0tOY2kBm1To/viAy4NH41/E0PVepeqWUNwfosccGHzusdYt/78OrQ1
xhQ+ssCm2F9lVUJlq/5q3CVnSDllYZLU+pba+a3SNLl7zPt5D0Tm5OjH1PmWcHq4
G2w8XHikIcmCy+0BcQa6vMnBcvy6X66jw4fxgGqo4Kfdu6lh7WmQC8uZ+8apQAC4
g8FFU/TS/HoDZiSbd5VQldEpjNdvLsKKg379WRxPxfxD8+4yA5YaV0vrc6djZBCN
Zeyb3fbupz6+jJFILl8NlAIC8B/0TEg8WzznTae7RFb2d79owQncriscopGrbqQ/
mBfatYal1S4C/GpGEcrIpUvyKPR7+l1GNSwYFWF8b4x7H91BhHqg3aXaf97DP5DY
x10K7vz1zCRRSpTwNs++lNmDpemF4e4h1w3/J96xy5eziT8S9jDnB0qWJlbC2a81
yHw7tFSdgPgKULHzAgMBAAECggGBALJs4WU3b+4E4hPLkWA1RQfjUywZVRGy8tVD
mpFZL8Keje8Al7doORr8VWaAniLV5ti1JmT628EKmiaHfl1v8fzInCZ9S1NeyauH
n6j7v2P15YeJ5bWQvVoMzYBulhKjymhmaBhVMGLMW4PLsSVzu3eWoFKczJhGBVRh
RamWTcxUdQP2QWxEDQPZIXvBvkiKVJ8g448mUHxielbxNuwIs2nKO3SuQHmHghgT
dfihgFAEJqdefFydoZEwTBAxjNaUX7WBRea0b7+MxGSUvs0h4+/hRWCkOEVFTLvU
NHoVOuYgTCQbgikr2IPmIkQo5nQy7VjWogNNst8E/OyIiZ04oSdaqiF3rFNnDnzb
kxJz70sp8ZwR+nNSjfDurhVp4VTAEXAteOodVx3MsBy8ODonmLCR3ofd8JWPZGHU
CcEDzyYBeEEtv8ykll7YA/rkpVDpgViRbZh1+V3gI6z/wVgI0teb26yY44H7t2Id
9MaV/6Qpp+wg2BqDT+BmCOFjI/jcYQKBwQDkjWGHkUoiIht/jxC9h+gzJEwtgQXo
VJ30jj/x2xIN6ySaiaHA1CLBgQRDkJGR4OXcSmY1+/hQTXVGRyyoEKiCi4jAc5EU
nhhvTXO/7RrbSZgWfkj8D/wb+XYtVvr7hwZUgdV7uR3rVaK8RGg3jlFTKO0ExBqB
9JQcUp/IQDOM8VSWpbdkwpx8851kTCrSw/QHrPGKINV5rNbv2OOTVOTpjSeuS+kR
C8RXFSPMR0g8PYQi+GBTSi8KTMkkID6DxqsCgcEA4TnErBuEpT7HSVlWJKkCz2aH
GsAR1TNaR9BOVm5RbZMaHaufwiiEB456hZSLP/jYPsgtOg0FwJ5ZXrV8P4CGvdEL
/wZZg7DZaPYRp4W6Jr+67HB9GMyw3TxMIwdT798uPEydzHEGN5lqsw9B7PWjgYHt
/jvKMLgdFTgA2ZwPuoimOqnRBMQq7/GdRuewU4fUbIq5oQvfQcY5hxaCb7wMTfFi
EiW/WJH/yhNuDmPHpkhq5OpR33cC2Uh9pw21A+HZAoHBAKq8K0WY9eZ10FEEUR8l
LgM2dGnx3rXmsHEG6yID44LeTGPduSZR0vz3InZOw1BUz6I3Og/OAXwLwTYU6XlL
qHaNQkVyj8j1KY/MLlIMEGoMmj8DbAZQ8qb7Pps0RR4tij8LFq3sZjttp7o46BnI
iVw0UIuk66B1U0etOYvg2iHKDsTTWyM8dqapXsSUWdFFbUFmorHrQU46Hf7i6W8g
ljkap6//KUcAoVXkhu+NuJq34cQ2A890tZteLUx9gfXzLQKBwCEeYopAXagC7EEf
7ufjJnOjCvjnB3hHXd4zhmF1RWoMeImmZA6j8I4/6EpeRn+4suvAec4QfikN3+xq
WYPo/WdKJy5wG5ee2MlzbbMpme76wJzmCa8s4lEV/cgk2rXqJp1dUtLuR9DDMYp1
EueqU0nG9l0tI5U4baZiHtXg+fse/vqfYAoIYpv39n2nsikGTzlKyPMikMjWQj1Y
FQQjLdgER7yNam62wVtQsh1RlNkhyv4waqumj3euDjQTcuvIOQKBwC5qichDbNOp
xnF5JfN3IRz+A1P4fhIzsmZ7ZKV179tJT+QNRPyF5U6CEBEcZbLxH6r7/tsOdXai
mR03AuvcZdbCO/uLeXPg0CsYuEb3VAn/1qD5RfdF9VyVA6O587W938z5GWIx/fAM
e4Air6pN00SLJTZDoXlMdbSDA52O0pm8on5zbPJH60OSHRbhaVXAQHBSHSVYzzIl
ahB/41gpFPr4XRBUBzfi9csW4T4TAOdY/0s1+sliZ8jkUNOcfqSspA==
-----END RSA PRIVATE KEY-----`;

	function givenGitHubReturnsToken(expectedAppToken?: string){
		githubNock
			.post(`/app/installations/${githubInstallationId}/access_tokens`)
			.matchHeader("Authorization", expectedAppToken ? `Bearer ${expectedAppToken}` : /^Bearer .+$/)
			.matchHeader("Accept", "application/vnd.github.v3+json")
			.matchHeader("Content-Type", /^.*$/)
			.matchHeader("User-Agent", /^.*$/)
			.reply(200, {
				expires_at: expirationDate.toISOString(),
				token: installationToken
			});
	}

	afterEach(() => {
		nock.cleanAll();
		jest.restoreAllMocks();
	});

	it("generates installation token", async () => {
		givenGitHubReturnsToken();

		const client = new GithubAppClient(privateKey, "106838");
		const authToken = await client.createInstallationToken(githubInstallationId);

		expect(authToken).toEqual({
			expirationDate: expirationDate,
			token: installationToken
		});
		expect(githubNock.pendingMocks()).toEqual([]);
	});

	it("re-generates expired app token", async () => {
		const originalAppToken = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJpYXQiOjE2Mzc3NTg3NDAsImV4cCI6MTYzNzc1OTQwMCwiaXNzIjoiMTA2ODM4In0.rIczMZQB-kyTW4Rf4uVT3TSLY5gwD8wn5k57ctejqhfHuyY3JViRTY_nIemGsyZAaIMBOdJQ1dL0TVI2hkXFGqAqZIONqfHJ4S9r7KhUeue-Dqkpfs7GRFBovExNzwwKPbdcpkjFUTVfHEmJlHOG4bzYVuJy6h1eapzPbv8Rx--_sjAoKl1jcim0G7Vj6obwaByfyBTRC5nrJQe4v_xMXT6QeC42dd1JCgmkGn8UtuA398DEOlT61Vq5s-eMFqC7BmQDnSJWAykFGAd0k3PLCLWGErSCyzhivmZf_O6Y0m62YtZvq1wGTpAbyh7KvhAwbKhuSZk9dd0aqM8lw7husdKMFwkpoQcbUv99d-NkVG4H-TQBek5u2L23gAT29268qlGda4E1a6ZHfaxeCk9Gow5oSwCTtKZ-MYVOgymrZpoUbdMGIQmAt-71ME7Bw6ZTpjaMEdp5D8GaEInFk6X5fnVkVlJjEQaIwL-CSJRa_Dd5puRe07TzsHiJaFLMpMPR";
		const freshAppToken = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJpYXQiOjE2NjkyOTUzNDAsImV4cCI6MTY2OTI5NjAwMCwiaXNzIjoiMTA2ODM4In0.bKg1exqqMFPdYT0f-Ox5cMVc_ckYPaXpz_iNY0YlNv1wBuc-BsyvtbrIbQ82QugDOASwjhErTp_IjtOWYMv4gW_9DZu3cH7J4pTjgRc_KX5I6uQpmUmoDUqmXYpgNznzRXqzZOVKkcexifavPY_JEPyAKul6BZGGQVOuQt0yL_vTVuP34eGFHZ71z_lRiPfPdMVW8etGKtMz4N_9GQoIiDmA4Svah27EMiWCFnyjRZt_rwe29poIBD-Vv9sHlYpAtRt_XJm83N22jDKGHFZic-BdL5dOSjf82f9rW9XnAXicLdtppxp6k2q09k4hKWkWIzWlSDXSk8cxh_rLFEgtavU3GDf_-ZlLLb32hTBEY2N5bALJh-ozyzrlb6slo3YFkuSoSVolRwN-1F12CkGZ2L9biINAE31ONd0I23-JXJK3S4LB3UtjMBKfXlU3Gx_GH2g_wmivreLMIv4Ogpu_PyBg0uRetggK9Jglj0n2lrzylW90FZ2xsU_IlI_IbpNf";
		let now = new Date(2021, 10, 25, 0, 0);
		const client = new GithubAppClient(privateKey, "106838", "https://api.github.com", () => now);

		givenGitHubReturnsToken(originalAppToken);
		await client.createInstallationToken(githubInstallationId);
		expect(githubNock.pendingMocks()).toEqual([]);

		// after 5 minutes the client should still use the original JWT because it's still valid
		now = new Date(2021,10,25, 0, 5);

		givenGitHubReturnsToken(originalAppToken);
		await client.createInstallationToken(githubInstallationId);
		expect(githubNock.pendingMocks()).toEqual([]);

		// after 10 minutes the client should use a fresh JWT because the original one is about to expire
		now = new Date(2022,10,25, 0, 10);

		givenGitHubReturnsToken(freshAppToken);
		await client.createInstallationToken(githubInstallationId);
		expect(githubNock.pendingMocks()).toEqual([]);
	});


});


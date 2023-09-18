import Token from "./token";
import Auth from "./auth";
import App from "./apps";
import Orgs from "./orgs";
import GitHub from "./github";

const ApiRequest = {
	token: Token,
	auth: Auth,
	gitHub: GitHub,
	app: App,
	orgs: Orgs
};

export default ApiRequest;

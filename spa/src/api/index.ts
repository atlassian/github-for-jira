import Token from "./token";
import Auth from "./auth";
import App from "./apps";
import Orgs from "./orgs";
import GitHub from "./github";
import Subscription from "./subscriptions";

const ApiRequest = {
	token: Token,
	auth: Auth,
	gitHub: GitHub,
	app: App,
	orgs: Orgs,
	subscriptions: Subscription,
};

export default ApiRequest;

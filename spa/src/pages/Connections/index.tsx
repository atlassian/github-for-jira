import { useState } from "react";
import SyncHeader from "../../components/SyncHeader";
import { Wrapper } from "../../common/Wrapper";
import ApiRequest from "../../api";
import Button from "@atlaskit/button";

const Connections = () => {
	const [ subscriptions, setSubscriptions ] = useState([]);

	const fetchSubscriptions = async () => {
		const subs = await ApiRequest.subscriptions.getSubscriptions();
		setSubscriptions(subs.data);
		console.log("Subs -----> ", subscriptions);
	};

	return (
		<Wrapper>
			<SyncHeader/>
			<div>
				List of connections should go here!
			</div>
			<Button appearance="link"  onClick={fetchSubscriptions}>Fetch here</Button>
		</Wrapper>
	);
};

export default Connections;

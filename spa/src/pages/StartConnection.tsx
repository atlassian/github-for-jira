import SyncHeader from "../common/SyncHeader";
import "../styles/start-connection.css";

const StartConnection = () => {
	return (
		<div className="container">
			<SyncHeader />
			<div className="before-text center-align">Before you start you'll need:</div>
			<div className="list-container">
				<div>GitHub account</div>
				<div>Owner permission for a GitHub organization</div>
				<div><a href="">Learn how to check Github permissions</a></div>
			</div>
		</div>
	);
};

export default StartConnection;

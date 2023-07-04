import "../styles/sync-header.css";

const SyncHeader = () => (
	<div className="center-align">
		<div className="logo-container">
			<img className="logo" src="public/assets/jira-logo.svg" alt=""/>
			<img className="sync-logo" src="public/assets/sync.svg" alt=""/>
			<img className="logo" src="public/assets/github-logo.svg" alt=""/>
		</div>
		<h2 className="title">Connect Github to Jira</h2>
	</div>
);

export default SyncHeader;

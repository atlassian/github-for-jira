import { useState, useEffect } from 'react'
import reactLogo from './assets/react.svg'
import './App.css'

function App() {
	const [jiraJwt, setJiraJwt] = useState("")
	const [fetching, setFetching] = useState(false)
	const [githubToken, setGitHubToken] = useState("")
	const [installations, setInstallations] = useState([]);

	const connectToOrg = async (installationId: number) => {
			AP.context.getToken(async (token) => {
				setJiraJwt(token);
				const resp = await fetch(`/github/configuration`, {
					method: "POST",
					headers: {
						Authorization: JSON.stringify({ jiraJwt: token, githubToken }),
						"Content-Type": "application/json"
					},
					body: JSON.stringify({
						installationId
					})
				});
				if(!resp.ok) {
					console.error(resp.statusText);
				} else {
					alert("Subscription created");
					fetchInstallationList();
				}
			});
	}

	const disConnectFromOrg = async (installationId: number, subscriptionId: number) => {
			AP.context.getToken(async (token) => {
				setJiraJwt(token);
				const resp = await fetch(`/jira/configuration`, {
					method: "DELETE",
					headers: {
						Authorization: JSON.stringify({ jiraJwt: token, githubToken }),
						"Content-Type": "application/json"
					},
					body: JSON.stringify({
						gitHubInstallationId: installationId
					})
				});
				if(!resp.ok) {
					console.error(resp.statusText);
				} else {
					alert("Subscription disconnected");
					fetchInstallationList();
				}
			});
	}

	const fetchInstallationList = async () => {
		try {
			setFetching(true);
			const resp = await fetch("/github/configuration?type=api", {
				method: "GET",
				headers: {
					Authorization: JSON.stringify({jiraJwt, githubToken})
				}
			});
			if(!resp.ok) {
				console.error(resp.statusText);
			} else {
				const { installations } = await resp.json();
				setInstallations(installations);
			}
		} catch (e) {
		} finally {
			setFetching(false);
		}

	}

	useEffect(() => {

		window.appInstalledCallback = async ({search}) => {
			const params = new URL(`http://atlassian.com${search}`).searchParams;
			const installationId = params.get("installation_id");
			if(!installationId) return;
			connectToOrg(installationId);
		};

		window.oauthCallback = async ({search}) => {
			AP.context.getToken(async (token) => {
				setJiraJwt(token);
				const resp = await fetch(`/github/oauth-exchange-token${search}`, {
					method: "POST",
					headers: {
						Authorization: JSON.stringify({ jiraJwt: token })
					},
					body: JSON.stringify({
						search
					})
				});
				if(!resp.ok) {
					console.error(resp.statusText);
				} else {
					const { accessToken } = await resp.json();
					setGitHubToken(accessToken);
				}
			});
		};

	}, []);

  return (
    <>
      <div>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Github for jira</h1>
			<div className="card">
				<span>Jira JWT: {(jiraJwt || "").substring(0, 10)}...</span>
				<br></br>
				<span>GitHub Token: {(githubToken || "").substring(0, 10)}...</span>
      </div>
      <div className="card">
				<button onClick={async () => {
					const resp = await fetch("/github/oauth-url");
					const result = await resp.json();
					if(result.redirectUrl) {
						window.open(result.redirectUrl);
					}
				}}>
					get token
				</button>
      </div>
			<div className="card">
				{ fetching ? "fetching..." : <button onClick={fetchInstallationList}> fetch orgs and subscriptions </button> }
      </div>
			<div className="card">
				{
					installations.map(installation => (
						<div className="card">
							<div>Owner: {installation.account.login}</div>
							<div>Number of repos: {installation.numberOfRepos}</div>
							<div>isAdmin: {""+installation.isAdmin}</div>
							<div>syncStatus: {installation.syncStatus}</div>
							<div>gitHubInstallationId: {installation.id}</div>
							<div>subscriptionId: {installation.subscriptionId}</div>
							<div>conection status: { !!installation.subscriptionId ?  "✅" : "❌" }</div>
							{ !installation.subscriptionId && ( <div><button onClick={() => {connectToOrg(installation.id)}}>connect</button></div>)}
							{ !!installation.subscriptionId && ( <div><button onClick={() => {disConnectFromOrg(installation.id, installation.subscriptionId)}}>disconnect</button></div>)}
						</div>
					))
				}
			</div>
			<div className="card">
				<button onClick={async () => {
					window.open("https://github.com/apps/garyx-atlassian-github-for-jira/installations/new");
				}}>
					Install to new org
				</button>
			</div>
    </>
  )
}

export default App

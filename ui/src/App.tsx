import { useState, useEffect } from 'react'
import reactLogo from './assets/react.svg'
import './App.css'

function App() {
	const [jiraJwt, setJiraJwt] = useState("")
	const [gitHubToken, setGitHubToken] = useState("")
	const [installations, setInstallations] = useState([]);

	useEffect(() => {
		window.oauthCallback = async ({search}) => {
			AP.context.getToken(async (token) => {
				setJiraJwt(token);
				const resp = await fetch(`/github/oauth-exchange-token${search}`, {
					method: "POST",
					headers: {
						Authorization: `Bearer ${token}`
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
				<span>GitHub Token: {(gitHubToken || "").substring(0, 10)}...</span>
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
				<button onClick={async () => {
					const resp = await fetch("/github/configuration/list", {
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
				}}>
					fetch orgs and subscriptions
				</button>
      </div>
    </>
  )
}

export default App

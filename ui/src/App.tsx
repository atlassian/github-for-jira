import { useState, useEffect } from 'react'
import reactLogo from './assets/react.svg'
import './App.css'

function App() {
	const [count, setCount] = useState(0)

	useEffect(() => {
		window.oauthCallback = async ({search}) => {
			console.log(`=======>>>>>>>> I got the search ${search}`);
			AP.context.getToken(async (token) => {
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
					alert("I got access token" + accessToken);
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
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <div className="card">
				<button onClick={async () => {
					const resp = await fetch("/github/oauth-url");
					const result = await resp.json();
					alert(JSON.stringify(result));
					if(result.redirectUrl) {
						window.open(result.redirectUrl);
					}
				}}>
					get token
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  )
}

export default App

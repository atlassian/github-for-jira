# For Development

This Single Page Application is already run when you start the GitHub for Jira app. The app should be running at `http://localhost:5173`.
For local instances, a proxy server has been created to run this locally, which is running on `https://NODE_TUNNEL_URL/spa`

# For Production

Simply run `yarn build`. This will create `dist` folder which is served by the GitHub for Jira app under the url `/spa`.
Check `router.ts#59`

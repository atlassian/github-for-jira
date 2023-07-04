# Overview

This is the new frontend version of the app in React JS. 

# For Development

This SPA is already run when you start the GitHub for Jira app. The app should be running at `http://localhost:5173`.
For local instances, a proxy server has been created to run this locally, which is running on `https://NODE_TUNNEL_URL/spa`.

# For Production

This SPA is build when you run the build for the GitHub for Jira app.
Running the `yarn build` should create `dist` folder which is served by the GitHub for Jira app under the url `/spa`.
Check `router.ts#59`

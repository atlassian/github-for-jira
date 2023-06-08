# Single Page Application for GitHub for Jira

This is a single page application for all the frontend view of the app GitHub for Jira.

# How to develop / run locally

In order to run this locally, firstly run this app using `yarn start`. This will run the app at `http://localhost:3000`, which is proxied in the node app.
So you can simply open the proxied route in `http://NODE_SERVER_URL:PORT/public/build`

**Note:**
A proxy server has been created in the node app in `dev.ts`, which runs this SPA into a route in node app ('/public/build').

_You can change the path by updating the name `public/build` in `package.json#homepage` and in `dev.ts` in the path defined in `httpProxy.createProxyServer()`_


# How to run in production

To run this in production, simply run ` yarn start:spa-prod`. 
This will create builds for `spa`, which is then copied to `/static`, which is then accessed by the route`/public/build/*`.
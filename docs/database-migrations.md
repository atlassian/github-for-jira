# Migrating the Database

This is a bit complicated because of how we connect these things and how it's deployed. This document should walk you through most of the sharp edges.

## Where

You'll want to use the environment appropriate for your migration:

*  jira-integration-staging
*  jira-integration-production


## Running the Migration

1.  Login to heroku's cli `heroku login`
1.  Run a bash shell on a Dyno `heroku run -a ${APP}`
1.  **DOUBLE CHECK** that `DATABASE_URL` is set correctly to the postgres attached to the app you're trying to migrate!
1.  Run the migration `./node_modules/.bin/sequelize db:migrate`
1.  :icecream:

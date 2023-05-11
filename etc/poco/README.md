# What is Poco?

In a nutshell, Poco is an Atlassian platform responsible for providing a means for service owners to specify
per-service/product policies, distribute the policies to the services, and to collect decision logs from the services.

See more details at [Poco (Policy Control)](https://developer.atlassian.com/platform/poco/).

# Pre-requisites

- You have [atlas-cli installed](https://developer.atlassian.com/platform/atlas-cli/users/install/)
- You have the [poco plugin installed](https://developer.atlassian.com/platform/poco/cli/installation/)

```shell
atlas plugin install -n poco
```

# Policies
- `bundle/main.json` main policy published in all environments

# How to test locally?
From the root of the project, run

```shell
atlas poco bundle test \
  -b etc/poco/bundle/main.json \
  -b etc/poco/bundle/extras-stg.json \
  -b etc/poco/bundle/extras-prod.json \
  -t etc/poco/bundle/main-test.json \
  -t etc/poco/bundle/extras-prod-test.json \
  -t etc/poco/bundle/extras-stg-test.json
```

Refer to [Testing](https://developer.atlassian.com/platform/poco/policies/workflow/testing/) for more details.

# How to test in staging?

Poco bundles can be manually published to dev and staging environments using atlas-cli. Note that this will apply
to the deployment stack already in service without needing to redeploy.

### Publish into dev
```shell
atlas poco bundle publish -s github-for-jira -e dev \
  -b etc/poco/bundle/main.json \
  -t etc/poco/bundle/main-test.json 
```

### Publish into staging
```shell
atlas poco bundle publish -s github-for-jira -e staging \
-b etc/poco/bundle/main.json \
-b etc/poco/bundle/extras-stg.json \
-t etc/poco/bundle/main-test.json \
-t etc/poco/bundle/extras-stg-test.json
```

# Deployment to production

Make sure all changes in the poco policy are backward compatible i.e. they can safely be applied to the current and new version of service.

Deployment to production happens automatically in the build.

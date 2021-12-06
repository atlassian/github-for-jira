# GitHub Actions - Builds

GitHub for Jira supports builds via [GitHub Actions workflow syntax](https://docs.github.com/en/actions/learn-github-actions/workflow-syntax-for-github-actions).
To set this up, you will need to need to create a .github folder at the root of a given repository and then make a child directory
called workflows. Inside of .github/workflows you will need to create a build.yml file. This is where you will specify the workflow for your builds.

Following is an example of a build.yml file:

```
# This is a basic workflow to help you get started with Actions

name: CI

# Controls when the action will run.
on:
  # Triggers the workflow on push or pull request events but only for the main branch
  push:
    branches:
      - main
  pull_request:
    branches:
      - main
      - feature/**

  # Allows you to run this workflow manually from the Actions tab
  workflow_dispatch:

# A workflow run is made up of one or more jobs that can run sequentially or in parallel
jobs:
  # This workflow contains a single job called "build"
  build:
    # The type of runner that the job will run on
    runs-on: ubuntu-latest

    # Steps represent a sequence of tasks that will be executed as part of the job
    steps:
      # Checks-out your repository under $GITHUB_WORKSPACE, so your job can access it
      - uses: actions/checkout@v2

      # Runs a single command using the runners shell
      - name: Run a one-line script
        run: echo Hello, world!

      # Runs a set of commands using the runners shell
      - name: Run a multi-line script
        run: |
          echo Add other actions to build,
          echo test, and deploy your project.
          sleep 60s
```

Once you have a similar file in any of your repositories that are connected to our app, you will start to see builds data
in the development panel in Jira.

![Builds data in Jira](./images/builds-data-jira-dev-panel.png)

One important thing to note is the branches being targeted under `pull_requests` `branches`:

```
pull_request:
    branches:
      - main
      - feature/**
```

If you were to have the same block but only target main, for instance, you would only see builds related to the most recent
commit message. This means that if a developer were to make multiple commits, perhaps on multiple branches, and
reference different Jira issue keys on each branch, GitHub would only send our app the latest commit. In turn, this
would mean that we could only extract any issue keys from that single message. Although there may be numerous Jira issues
involved, in this scenario, you would only see builds data for any issue keys from the latest commit message.

In order for the GitHub for Jira app to be able to compare two points in your git history (possible once a pull request is opened),
you'll need to be very specific about the branches you want to target. If any branch is created that isn't listed pull_requests branches
block, the app won't be able to compare your commits and send the most accurrate data to Jira.

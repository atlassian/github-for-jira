# E2E Tests

We use [playright](https://playwright.dev/) for e2e tests which is a well thought out and fast runner that can parallelize tests - by default, by file but can be made fully parallel for each test.  It also has full Typescript support which is a big plus for us.

## Getting Started

To run tests locally, you need to start your local app server ([follow the instructions from CONTRIBUTING](../CONTRIBUTING.md)) by doing `docker-compose up` and wait for that to start before running one of the following commands to run the tests:

* `yarn test:e2e` to run the tests in headless mode, which is the fastest mode
* `yarn test:e2e:headed` to run the tests in headed mode, which is slower, but gives you an idea of what's going on
* `yarn test:e2e:debug` to run the tests in debug mode. Way slower as you need to press 'continue' to start the process, but it gives you a great idea of what's going wrong with your tests

However, that being said, the tests are still going to be flaky as we are still dependent on Jira which tends to change their testids and other UI elements quite often with very little consistency.  There's also the issue of shared state - since this app is completely dependent on having it installed on the Jira instance, this shared state prevents tests from running in parallel or else they would step on each other's toes.  As such, we're limiting the tests to 1 worker (one test at a time) and making all e2e tests have a concurrency group as multiple CI runs can't run at the same time.  It does make the tests run slower, but means we'll have more stability for the time being.

## Writing Tests

When writing e2e tests, always be aware of state - your tests should create and clean up all resources needed for itself and not leave anything behind.  Timing is everything - tests that work in `test:e2e:headed` mode might not in `test:e2e` mode because of how quicker it runs.  You must take into considerations UI animations, HTTP requests and other oddities when writing tests - for the most part, Playwright fixes this by its constant polling until the selector is available, but there are some situations where this doesn't help and you might need to use `waitForLoadState`, `waitFor` or some of the other waiting functions.  It's _strongly recommended_ not to use a time based delay as it's not stable and will take longer to accomplish.

Try to use utility functions where you can, like `page.click(".some-selector")` instead of `page.locator(".some-selector").click()`, unless this is a selector that is used multiple times, which you can then save to a variable.  All actions can be used this way.  When you can, you want to be specific as to which element you want to get, like getting it via attributes like `class`, `id` or `data-testid`, but in some situations you need to use some of the [less common ones](https://playwright.dev/docs/locators).  I would suggest to use `getByTestId()`, however this only works for the attribute `data-testid` and many places within Jira is using `data-test-id`.  In these situations, we must use an attribute selector (eg. `page.locator("[data-test-id='some-id'])`).  Furthermore, we should start to use `data-testid` in our own UI to make it easier for our own end to end tests - just make sure that the testid conforms to a convention (please don't use versioning of testids).

There are some situation where you can do 2 actions at the same time, for those situations, you can use `Promise.all` to parallelize those actions and make your tests faster.

For some of those UI changes that happen in Jira, there are some situations that you want to click on an element but there's multiple possible selectors used (new one and old one), in these cases you can use a comma to separate multiple selectors.  Whichever one matches first gets to do the action.  For example, `page.click(".selector-one, .selector-two")` will click on the element that matches first.

In the setup, we already create a test project that can be used for all tests as well as login state for jira.  If you do need a login state to be used, add the `storageState` to the `test.describe` block to leverage it.

## Debugging

By using `test:e2e:debug`, you can have control over the tests.  If you want to have a breakpoint in the code, simply add `await page.pause();` or you can add playwright test runner in your IDE to make debugging even easier.  If any issues are having errors as part of the run, look at the `test/e2e/test-results/tests` folder to show those that failed, a screenshot of the place where it failed and a video of how it got there.  This is a great way to see discrepancies in the CI build without having to replicate it locally first.

## Troubleshooting

Some of the issues you might be seeing aren't always obvious.  A simple missing `await` can cause some very weird issues or flakiness.  For the most part, Playwright is pretty good at telling us where the problem lies, but for those time where it doesn't, it can help to try to isolate the issue.  You can do this by adding `.only` to a `test` or `test.describe` so that it's the only test that runs to see if you can isolate the issue to a single file/test.  Often times, the problem is state based, like a previous test not cleaning up after itself when done.

## Next Steps

* Unflake the tests as much as possible
* Add e2e tests as a required job to run (setting > branches > edit branch protection rule > required jobs)
* Add some testids in our own codebase for easier tests
* Try to set some kind of standard for the rest of Jira so that testids stop changing on every UI update so make the tests less flaky.  testids should be be about persistent behaviors and not like a regular HTML element id.
* Figure out tests that can be parallelized easily.  The main issue currently is the app-installation tests as they install and remove the app which changes the behavior of Jira.  These could be potentially skipped as we are installing the app as part of the setup or maybe we find a way to run then first in sequence, then all others can be parallel.  Remove the `workers` property in the configuration file to allow concurrent test.
* Make sure the e2e tests running have a unique app identifier per test run (you could use `github_test_run_id`).  After this we should be able to remove the the concurrency group in our Github workflow file for e2e tests so that multiple PRs can run at the same time without interference.
* We still need to add github login (with state), and github app install/uninstall
* Add e2e tests that tests critical paths in product

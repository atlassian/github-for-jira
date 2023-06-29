"""
GitHub Repository Automation Script

This script automates the creation of repositories with branches and commits on GitHub. It utilizes the GitHub API and Git commands to perform the following actions:

1. Create multiple repositories with specified names.
2. Initialize each repository with a README file and a GitHub Actions workflow file.
3. Create multiple branches within each repository.
4. Make commits with random file content to each branch.
5. Push the commits to the respective branches.
6. Create pull requests from each branch to the main branch.
7. Optionally merge the pull requests randomly.
8. Repeat the above steps for the specified number of repositories, branches, and commits.

Usage:
1. Set the desired values for the following parameters at the top of the script:
   - ACCESS_TOKEN: Your GitHub personal access token (PAT).
   - ORGANIZATION_NAME: The name of your GitHub organization.
   - DEFAULT_NUM_REPOS: The default number of repositories to create.
   - DEFAULT_NUM_BRANCHES: The default number of branches to create per repository.
   - DEFAULT_NUM_COMMITS: The default number of commits to make per branch.
   - DEFAULT_ISSUE_PREFIX: The default prefix for issue/commit messages.

2. Open a terminal and navigate to the directory containing this script.

3. Run the script using the following command:
   $ python3 generate-github-test-data.py.py [--num-repos NUM_REPOS] [--num-branches NUM_BRANCHES] [--num-commits NUM_COMMITS] [--issue-prefix ISSUE_PREFIX]

   example:
   $ python3 generate-github-test-data.py --num-repos 5 --num-branches 4 --num-commits 11 --issue-prefix CAT

   Optional Arguments:
   --num-repos NUM_REPOS: Number of repositories to create.
   --num-branches NUM_BRANCHES: Number of branches to create per repository .
   --num-commits NUM_COMMITS: Number of commits to make per branch.
   --issue-prefix ISSUE_PREFIX: Prefix for issue/commit messages.

4. The script will start creating repositories, branches, and making commits. The progress will be displayed in the terminal.

5. If the script execution is interrupted, it will save the last successful state to a state file.

6. To resume the script from the last successful state, run the script with the same arguments. It will skip already created repositories, branches, and commits.

7. After completion or interruption, the script will save the state to the state file for future resumptions.

Note: Make sure you have the necessary permissions and the GitHub organization exists.

"""

import argparse
import requests
import os
import subprocess
import time
import string
import random
import json

# GitHub API base URL
BASE_URL = 'https://api.github.com'

# GitHub access token
ACCESS_TOKEN = 'YOUR_PAT_GOES_HERE'

# GitHub org name
ORGANIZATION_NAME = 'YOUR_ORG_GOES_HERE'

# Default values
DEFAULT_NUM_REPOS = 2
DEFAULT_NUM_BRANCHES = 1
DEFAULT_NUM_COMMITS = 1
DEFAULT_ISSUE_PREFIX = "ARC"

# Parse command-line arguments
parser = argparse.ArgumentParser(description='Create repositories with branches and commits on GitHub.')
parser.add_argument('--num-repos', type=int, default=DEFAULT_NUM_REPOS, help='Number of repositories to create')
parser.add_argument('--num-branches', type=int, default=DEFAULT_NUM_BRANCHES, help='Number of branches to create per repository')
parser.add_argument('--num-commits', type=int, default=DEFAULT_NUM_COMMITS, help='Number of commits to make per branch')
parser.add_argument('--issue-prefix', type=str, default=DEFAULT_ISSUE_PREFIX, help='Prefix for issue/commit messages')
args = parser.parse_args()

# Helper function to make authenticated API requests
def make_api_request(method, url, headers=None, data=None):
    headers = headers or {}
    headers['Authorization'] = f'Bearer {ACCESS_TOKEN}'
    response = requests.request(method, url, headers=headers, json=data)
    response.raise_for_status()
    return response.json()

# Helper function to execute bash commands
def run_bash_command(command):
    process = subprocess.Popen(command, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    stdout, stderr = process.communicate()
    return process.returncode, stdout, stderr

# Helper function to create a new branch
def create_branch(branch_name):
    create_branch_command = f'git checkout -b {branch_name}'
    return_code, stdout, stderr = run_bash_command(create_branch_command)
    if return_code != 0:
        raise RuntimeError(f'Error creating branch "{branch_name}": {stderr.decode()}')
    print(f'Branch "{branch_name}" created successfully.')

# Helper function to commit and push changes
def commit_and_push_changes(branch_name, file_name, commit_message):
    content = generate_random_content()
    with open(file_name, 'w') as file:
        file.write(content)

    add_file_command = f'git add {file_name}'
    return_code, stdout, stderr = run_bash_command(add_file_command)
    if return_code != 0:
        raise RuntimeError(f'Error adding file "{file_name}" to Git: {stderr.decode()}')

    commit_command = f'git commit -m "{commit_message}"'
    return_code, stdout, stderr = run_bash_command(commit_command)
    if return_code != 0:
        raise RuntimeError(f'Error committing file "{file_name}": {stderr.decode()}')

    push_command = f'git push origin {branch_name}'
    return_code, stdout, stderr = run_bash_command(push_command)
    if return_code != 0:
        raise RuntimeError(f'Error pushing commits to branch "{branch_name}": {stderr.decode()}')
    print(f'Commit {commit_message} pushed to branch "{branch_name}" successfully.')

def generate_random_content():
    # Generate a random string of uppercase letters and digits
    length = random.randint(10, 20)
    characters = string.ascii_uppercase + string.digits
    content = ''.join(random.choice(characters) for _ in range(length))
    return content

# Function to initialize the repository, add README, and push the initial commit
def initialize_repository(repo_name):
    os.makedirs(repo_name)
    os.chdir(repo_name)
    subprocess.run('git init', shell=True, check=True)
    os.system('echo "# README" >> README.md')
    create_workflow_file()
    subprocess.run('git add .', shell=True, check=True)
    subprocess.run('git commit -m "Initial commit"', shell=True, check=True)
    subprocess.run('git branch -M main', shell=True, check=True)
    subprocess.run(f'git remote add origin https://github.com/{ORGANIZATION_NAME}/{repo_name}.git', shell=True, check=True)
    subprocess.run('git push -u origin main', shell=True, check=True)
    print(f'Repository "{repo_name}" initialized and initial commit pushed successfully.')

# Add main.yml to .github/workflows directory
def create_workflow_file():
    workflow_file_name = 'main.yml'
    workflow_file_path = os.path.join(os.getcwd(), '.github', 'workflows', workflow_file_name)
    os.makedirs(os.path.dirname(workflow_file_path), exist_ok=True)

    with open('../build-and-deploy-workflow-example.yml', 'r') as source_file:
        content = source_file.read()
        with open(workflow_file_path, 'w') as workflow_file:
            workflow_file.write(content)

    subprocess.run(f'git add .github/workflows/{workflow_file_name}', shell=True, check=True)

def create_pull_request(repo_name, branch_name):
    create_pull_request_url = f'{BASE_URL}/repos/{ORGANIZATION_NAME}/{repo_name}/pulls'
    pull_request_data = {
        'title': f'{args.issue_prefix}-{random.randint(100, 999)}: Pull request',
        'body': f'{args.issue_prefix}-{random.randint(100, 999)}: Pull request body',
        'head': branch_name,
        'base': 'main'
    }
    pull_request_response = make_api_request('POST', create_pull_request_url, data=pull_request_data)
    print(f'Pull request created from "{branch_name}" to main successfully.')

    # Step 9: Randomly decide to merge the pull request (50/50 chance)
    should_merge = random.choice([True, False])
    if should_merge:
        pull_request_number = pull_request_response['number']
        merge_pull_request_url = f'{BASE_URL}/repos/{ORGANIZATION_NAME}/{repo_name}/pulls/{pull_request_number}/merge'
        make_api_request('PUT', merge_pull_request_url)
        print(f'Pull request from "{branch_name}" to main merged successfully.')
    else:
        print(f'Pull request from "{branch_name}" to main will not be merged.')

# Generate a unique repository name based on epoch time
base_repo_name = f'repo-{int(time.time())}'

# Create a state file path
state_file = 'state.json'

try:
    if os.path.isfile(state_file):
        # If the state file exists, load the last successful state
        with open(state_file, 'r') as f:
            state = json.load(f)
    else:
        # If the state file doesn't exist, initialize the state
        state = {
            'repo_index': -1,
            'branch_index': -1,
            'commit_index': -1
        }

    for repo_index in range(state['repo_index'] + 1, args.num_repos):
        repo_name = f'{base_repo_name}-{repo_index}'

        # Step 1: Create the repository
        create_repo_url = f'{BASE_URL}/orgs/{ORGANIZATION_NAME}/repos'
        create_repo_data = {'name': repo_name}
        make_api_request('POST', create_repo_url, data=create_repo_data)
        print(f'Repository "{repo_name}" created successfully.')

        # Update the state after successful repository creation
        state['repo_index'] = repo_index

        try:
            initialize_repository(repo_name)
        except Exception as e:
            print('ERROR:SKIPPING:REPO')
            print(f'{e}')
            continue

        for branch_index in range(state['branch_index'], args.num_branches):
            branch_name = f'{args.issue_prefix}-{random.randint(100, 999)}-{int(time.time())}'

            # Step 4: Create a new branch
            try:
                create_branch(branch_name)
            except Exception as e:
                print('ERROR:SKIPPING:BRANCH')
                print(f'{e}')
                continue

            for commit_index in range(state['commit_index'], args.num_commits):
                file_name = f'file-{commit_index}.txt'
                commit_message = f'{args.issue_prefix}-{random.randint(100, 999)}: Commit message'

                try:
                    # Step 6: Make a commit and push the changes
                    commit_and_push_changes(branch_name, file_name, commit_message)
                except Exception as e:
                    print('ERROR:SKIPPING:COMMIT')
                    print(f'{e}')
                    continue

            try:
                # Step 7: Create a pull request
                create_pull_request(repo_name, branch_name)
            except Exception as e:
                print('ERROR:SKIPPING:PULL')
                print(f'{e}')
                continue

        # move back up to original directory before next repo
        os.chdir('..')

    print('Script completed successfully.')


except Exception as e:
    print('An error occurred:', str(e))

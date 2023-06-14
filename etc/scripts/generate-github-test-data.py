# usage
# Step 1: Generate a Personal Access Token (PAT) from GitHub
# Step 2: Replace YOUR_PAT_GOES_HERE and USERNAME with your own details
# Step 3: python3 generate-github-test-data.py
# it will create repo data locally and you have to manually clean it up for now, TODO
#
# For more control.........
# You can customize the script behavior by providing command-line arguments:
# --num-repos: Number of repositories to create.
# --num-branches: Number of branches to create per repository.
# --num-commits: Number of commits to make per branch.
# --issue-prefix: Prefix for issue/commit messages.

# python3 generate-github-test-data.py --num-repos 5 --num-branches 3 --num-commits 2


import argparse
import requests
import os
import subprocess
import time
import random

# GitHub API base URL
BASE_URL = 'https://api.github.com'

# GitHub access token
ACCESS_TOKEN = 'YOUR_PAT_GOES_HERE'

# GitHub username
USERNAME = 'USERNAME'

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
    add_file_command = f'git add {file_name}'
    return_code, stdout, stderr = run_bash_command(add_file_command)
    if return_code != 0:
        raise RuntimeError(f'Error adding file "{file_name}" to Git: {stderr.decode()}')

    commit_command = f'git commit -m "{commit_message}"'
    return_code, stdout, stderr = run_bash_command(commit_command)
    if return_code != 0:
        raise RuntimeError(f'Error committing file "{file_name}": {stderr.decode()}')
    print(f'File "{file_name}" committed successfully.')

    push_command = f'git push origin {branch_name}'
    return_code, stdout, stderr = run_bash_command(push_command)
    if return_code != 0:
        raise RuntimeError(f'Error pushing commits to branch "{branch_name}": {stderr.decode()}')
    print(f'Commits pushed to branch "{branch_name}" successfully.')

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
    subprocess.run(f'git remote add origin https://github.com/{USERNAME}/{repo_name}.git', shell=True, check=True)
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

    os.system(f'git add .github/workflows/{workflow_file_name}')

def create_pull_request(repo_name, branch_name):
    create_pull_request_url = f'{BASE_URL}/repos/{USERNAME}/{repo_name}/pulls'
    pull_request_response = make_api_request('POST', create_pull_request_url, data=pull_request_data)
    print(f'Pull request created from "{branch_name}" to main successfully.')

    # Step 9: Randomly decide to merge the pull request (50/50 chance)
    should_merge = random.choice([True, False])
    if should_merge:
        pull_request_number = pull_request_response['number']
        merge_pull_request_url = f'{BASE_URL}/repos/{USERNAME}/{repo_name}/pulls/{pull_request_number}/merge'
        make_api_request('PUT', merge_pull_request_url)
        print(f'Pull request from "{branch_name}" to main merged successfully.')
    else:
        print(f'Pull request from "{branch_name}" to main will not be merged.')

# Generate a unique repository name based on epoch time
base_repo_name = f'repo-{int(time.time())}'

try:
    for repo_index in range(args.num_repos):
        repo_name = f'{base_repo_name}-{repo_index}'

        # Step 1: Create a new repository
        create_repo_url = f'{BASE_URL}/user/repos'
        data = {
            'name': repo_name,
            'private': False
        }
        make_api_request('POST', create_repo_url, data=data)
        print(f'Repository "{repo_name}" created successfully.')

        # Step 2: Initialize the repository, add README, create workflows, and push initial commit
        initialize_repository(repo_name)

        # Step 3: Create branches and commits
        for branch_index in range(args.num_branches):

            # Generate a unique branch name with the issue-key prefix and ranfom number
            branch_name = f'{args.issue_prefix}-{random.randint(100, 999)}'
            # Create a new branch
            create_branch(branch_name)

            for commit_index in range(args.num_commits):
                # Generate a unique file name based on epoch time and random number
                file_name = f'file-{int(time.time())}-{random.randint(100, 999)}.txt'

                # Generate a commit message based on issue prefix and random number
                commit_message = f'{args.issue_prefix}-{random.randint(100, 999)}'

                # Create and write to the file
                with open(file_name, 'w') as f:
                    f.write(f'Commit {commit_index + 1} on repository {repo_name}')

                # Commit and push changes
                commit_and_push_changes(branch_name, file_name, commit_message)

                # Remove the file
                os.remove(file_name)

            pull_request_data = {
                'title': f'Pull request from {branch_name} to main',
                'head': branch_name,
                'base': 'main'
            }

            create_pull_request(repo_name, branch_name)

        # Back out of repo
        os.chdir('..')

except Exception as e:
    print(f'An error occurred: {str(e)}')

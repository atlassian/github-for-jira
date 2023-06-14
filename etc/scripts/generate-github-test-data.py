import argparse
import requests
import os
import subprocess
import time
import random
import shutil

# GitHub API base URL
BASE_URL = 'https://api.github.com'

# GitHub access token
ACCESS_TOKEN = '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'

# GitHub username
USERNAME = 'joshkay10'

# Default values
DEFAULT_NUM_REPOS = 2
DEFAULT_NUM_BRANCHES = 1
DEFAULT_NUM_COMMITS = 1
DEFAULT_ISSUE_PREFIX = "ARC"

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

    commit_command = f'git commit -m "{ISSUE_PREFIX}-{commit_message}"'
    return_code, stdout, stderr = run_bash_command(commit_command)
    if return_code != 0:
        raise RuntimeError(f'Error committing file "{file_name}": {stderr.decode()}')
    print(f'File "{file_name}" committed successfully.')

    push_command = f'git push origin {branch_name}'
    return_code, stdout, stderr = run_bash_command(push_command)
    if return_code != 0:
        raise RuntimeError(f'Error pushing commits to branch "{branch_name}": {stderr.decode()}')
    print(f'Commits pushed to branch "{branch_name}" successfully.')

# Parse command-line arguments
parser = argparse.ArgumentParser(description='Create repositories with branches and commits on GitHub.')
parser.add_argument('--num-repos', type=int, default=DEFAULT_NUM_REPOS, help='Number of repositories to create')
parser.add_argument('--num-branches', type=int, default=DEFAULT_NUM_BRANCHES, help='Number of branches to create per repository')
parser.add_argument('--num-commits', type=int, default=DEFAULT_NUM_COMMITS, help='Number of commits to make per branch')
parser.add_argument('--issue-prefix', type=str, default=DEFAULT_ISSUE_PREFIX, help='Prefix for issue/commit messages')
args = parser.parse_args()

# Generate a unique repository name based on epoch time
base_repo_name = f'repo-{int(time.time())}'

try:
    for repo_index in range(args.num_repos):
        # Generate a unique repository name based on epoch time
        repo_name = f'{base_repo_name}-{repo_index + 1}'

        # Create a new repository
        create_repo_url = f'{BASE_URL}/user/repos'
        data = {
            'name': repo_name,
            'private': False
        }
        make_api_request('POST', create_repo_url, data=data)
        print(f'Repository "{repo_name}" created successfully.')

        for branch_index in range(args.num_branches):
            # Generate a unique branch name based on epoch time and random number
            branch_name = f'branch-{int(time.time())}-{random.randint(100, 999)}'

            # Create a new branch
            create_branch(branch_name)

            for commit_index in range(args.num_commits):
                # Generate a unique file name based on epoch time and random number
                file_name = f'file-{int(time.time())}-{random.randint(100, 999)}.txt'

                # Generate a unique commit message based on issue prefix and random number
                commit_message = f'{args.issue_prefix}-{random.randint(100, 999)}'

                # Create and write to the file
                with open(file_name, 'w') as f:
                    f.write(f'Commit {commit_index + 1} on branch {branch_name} of repository {repo_name}')

                # Commit and push changes
                commit_and_push_changes(branch_name, file_name, commit_message)

                # Remove the file
                os.remove(file_name)

        # Delete the repository
        delete_repo_url = f'{BASE_URL}/repos/{USERNAME}/{repo_name}'
        make_api_request('DELETE', delete_repo_url)
        print(f'Repository "{repo_name}" deleted successfully.')

except Exception as e:
    print(f'An error occurred: {str(e)}')

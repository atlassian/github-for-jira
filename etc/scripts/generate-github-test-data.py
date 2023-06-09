# HOW TO USE ME?
#
# Generate a personal access token from GitHub(PAT)
# replace ACCESS_TOKEN with the PAT
# replace USERNAME with GitHub username
#
#


import requests
import os
import subprocess
import time
import random

# GitHub API base URL
BASE_URL = 'https://api.github.com'

# GitHub access token
ACCESS_TOKEN = ''

# GitHub username
USERNAME = 'joshkay10'

# Number of branches and loop iterations
NUM_BRANCHES = 5
LOOP_ITERATIONS = 3

# Helper function to make authenticated API requests
def make_api_request(method, url, headers=None, data=None):
    headers = headers or {}
    headers['Authorization'] = f'Bearer {ACCESS_TOKEN}'
    response = requests.request(method, url, headers=headers, json=data)
    try:
        response.raise_for_status()
        return response.json()
    except requests.exceptions.HTTPError as e:
        print(f'Error making API request: {e}')
        print(f'Response: {response.text}')
        raise

# Helper function to execute bash commands
def run_bash_command(command):
    process = subprocess.Popen(command, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    stdout, stderr = process.communicate()
    return process.returncode, stdout, stderr

# Generate a unique repository name based on epoch time
repo_name = f'repo-{int(time.time())}'

try:
    # Step 1: Create a new repository
    repo_data = {
        'name': repo_name
    }
    create_repo_url = f'{BASE_URL}/user/repos'
    make_api_request('POST', create_repo_url, data=repo_data)
    print(f'Repository "{repo_name}" created successfully.')

    # Step 2: Initialize the repository, add README, and push initial commit
    os.mkdir(repo_name)
    os.chdir(repo_name)
    os.system('git init')
    os.system('echo "# README" >> README.md')
    os.system('git add README.md')
    os.system('git commit -m "first commit"')
    os.system(f'git branch -M main')
    os.system(f'git remote add origin https://github.com/{USERNAME}/{repo_name}.git')
    os.system(f'git push -u origin main')

    for i in range(NUM_BRANCHES):
        branch_name = f'branch-{i}'

        # Step 3: Create a new branch
        create_branch_command = f'git checkout -b {branch_name}'
        return_code, stdout, stderr = run_bash_command(create_branch_command)
        if return_code != 0:
            raise RuntimeError(f'Error creating branch "{branch_name}": {stderr.decode()}')
        print(f'Branch "{branch_name}" created successfully.')

        for j in range(LOOP_ITERATIONS):
            # Step 4: Create and modify a file
            file_name = f'file-{i}-{j}.txt'
            file_path = os.path.join(os.getcwd(), file_name)
            with open(file_path, 'w') as file:
                file.write(f'Content of file {i}-{j}')

            # Step 5: Add the file to Git
            add_file_command = f'git add {file_name}'
            return_code, stdout, stderr = run_bash_command(add_file_command)
            if return_code != 0:
                raise RuntimeError(f'Error adding file "{file_name}" to Git: {stderr.decode()}')

            # Step 6: Commit the file
            commit_message = f'new file {i}-{j}'
            commit_command = f'git commit -m "{commit_message}"'
            return_code, stdout, stderr = run_bash_command(commit_command)
            if return_code != 0:
                raise RuntimeError(f'Error committing file "{file_name}": {stderr.decode()}')
            print(f'File "{file_name}" committed successfully.')

            # Step 7: Push commits to the branch
            push_command = f'git push origin {branch_name}'
            return_code, stdout, stderr = run_bash_command(push_command)
            if return_code != 0:
                raise RuntimeError(f'Error pushing commits to branch "{branch_name}": {stderr.decode()}')
            print(f'Commits pushed to branch "{branch_name}" successfully.')

        # Step 8: Create a pull request from the branch to main
        pull_request_data = {
            'title': f'Pull request from {branch_name} to main',
            'head': branch_name,
            'base': 'main'
        }
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

except Exception as e:
    print(f'Error: {str(e)}')

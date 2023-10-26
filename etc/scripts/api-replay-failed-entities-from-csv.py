"""
Script replay the rejected vulnerabilities by data depot. Simply export the logs of rejected vulnerabilities from the splunk and run the script with the log file

1. Run the following splunk query to search for rejected vulnerabilities 
    `micros_github-for-jira` env=prod* "Data depot rejected" 
2. Export the splunk logs in csv format
3. Running the script:
    $ python3 ./api-replay-failed-entities-from-csv.py --env [ dev | staging | prod ] --sleep [ sleep-duration ] --input [ input-file-name.csv ]
Example
    $ python3 ./api-replay-failed-entities-from-csv.py --env staging --batchsize 100 --input failed-entities.csv  --sleep 10

First time setup:

1. virtualenv env -p python3
2. source env/bin/activate
3. pip install requests
"""

import argparse
import csv
import logging
import requests
import subprocess
import sys
import time
import json
from requests import Request
from requests.auth import AuthBase
from typing import NamedTuple
from dataclasses import dataclass
from json import JSONEncoder

LOG = logging.getLogger(__name__)

session = requests.Session()

def configure_logging(level='DEBUG'):
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s')

    ch = logging.StreamHandler(sys.stdout)
    ch.setFormatter(formatter)
    ch.setLevel(level)

    root = logging.getLogger()
    root.setLevel(level)
    root.addHandler(ch)

class SLAuth(AuthBase):
    def __init__(self, audience, group, environment):
        self.audience = audience
        self.group = group
        self.environment = environment

    def __call__(self, req: Request) -> Request:
        cmd = ['atlas',
               'slauth', 'token',
               '-m',
               '-g', self.group,
               '-e', self.environment,
               '-a', self.audience]
        data = subprocess.check_output(cmd)
        jwt = data.decode('utf-8').strip()

        req.headers['Authorization'] = f'slauth {jwt}'
        return req


def create_slauth(env: str) -> SLAuth:
    return SLAuth(
        audience=f'github-for-jira',
        group=f'micros-sv--github-for-jira-dl-admins',
        environment=env
    )


class Environment(NamedTuple):
    github_for_jira_url: str
    github_for_jira_auth: object

def create_environment(env: str) -> Environment:
  print("Running for env", env)
  if env == 'dev':
      return Environment(
          github_for_jira_url='https://github-for-jira.ap-southwest-2.dev.atl-paas.net',
          github_for_jira_auth=create_slauth(env))
  elif env == 'staging':
      return Environment(
          github_for_jira_url='https://github-for-jira.us-west-1.staging.atl-paas.net',
          github_for_jira_auth=create_slauth(env))
  elif env == 'prod':
      return Environment(
          github_for_jira_url='https://github-for-jira.sgw.prod.atl-paas.net',
          github_for_jira_auth=create_slauth(env))
  else:
      raise ValueError(f'Invalid environment {env}')
  
@dataclass(frozen=True)
class FailedEntity:
    gitHubInstallationId: int
    hashedJiraHost: str
    identifiers: list

    @staticmethod
    def from_dict(d):
        return FailedEntity(d['gitHubInstallationId'], d['jiraHost'], d['rejectedEntities{}.key.vulnerabilityId'].split("\n"))

class ReplayEntity:
    def __init__(self, gitHubInstallationId, hashedJiraHost, identifier):
        self.gitHubInstallationId = gitHubInstallationId
        self.hashedJiraHost = hashedJiraHost
        self.identifier = identifier

    def to_json(self):
        return {
            'gitHubInstallationId': self.gitHubInstallationId,
            'hashedJiraHost': self.hashedJiraHost,
            'identifier': self.identifier
        }

def process_replayEntities(env: Environment, replayEntities: list) -> bool:
    url = '{}/api/replay-rejected-entities-from-data-depot'.format(env.github_for_jira_url)
    
    replayEntitiesJson = []
    for replayEntity in replayEntities:
        replayEntitiesJson.append(replayEntity.to_json())

    response = session.post(url,
      auth=env.github_for_jira_auth,
      json={
        "replayEntities": replayEntitiesJson
      },
      headers = {"Content-Type": "application/json"})

    LOG.info("Response status %s" , response.status_code)
    LOG.info("Response text %s" , response.text)
    
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--env', choices=('dev', 'staging', 'prod'), required=True)
    parser.add_argument('--batchsize', default=100, type=int, help='How many jiraHosts to process each iteration')
    parser.add_argument('--input', type=argparse.FileType('r'), required=True)
    parser.add_argument('--sleep', type=int, help='How long to wait between requests in seconds', required=True)
    parser.add_argument('--level', default='INFO', choices=('INFO', 'ERROR', 'WARNING', 'DEBUG', 'CRITICAL'))
    args = parser.parse_args()

    configure_logging(level=args.level)

    env = create_environment(args.env)
    input_file = args.input

    input_reader = csv.DictReader(input_file)

    replayEntities = []
    for row in input_reader:
        failedEntity = FailedEntity.from_dict(row)
        for identifier in failedEntity.identifiers:
            replayEntities.append(ReplayEntity(failedEntity.gitHubInstallationId, failedEntity.hashedJiraHost, identifier.strip()))
    

    LOG.info("Total failed entities to process %s", len(replayEntities))
    for i in range(0, len(replayEntities), args.batchsize):
        replayEntitiesBatch = replayEntities[i:i+args.batchsize]
        LOG.info("processing batch from %s to %s", i+1, i+len(replayEntitiesBatch));
        process_replayEntities(env, replayEntitiesBatch)
        time.sleep(args.sleep)

if __name__ == '__main__':
    main()
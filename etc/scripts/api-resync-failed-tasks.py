"""
Script triggers the backfill for the subscriptions. Download the failed subscriptions from database in a CSV format and run the script with the CSV file.

1. Run the following database query to search for failed backfilled tasks 
    select distinct("subscriptionId")  from "RepoSyncStates" rss where "dependabotAlertStatus" = 'failed'
2. Download the query result in csv format
3. Running the script:
    $ python3 ./api-replay-failed-entities-from-csv.py --env [ dev | staging | prod ] --task [dependabotAlert | secretScanningAlert | codeScanningAlert] --sleep [ sleep-duration ] --input [ input-file-name.csv ]
Example
   $ python3 ./api-resync-failed-tasks.py --env staging --batchsize 100 --input sample.csv --task dependabotAlert  --sleep 1

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
from requests import Request
from requests.auth import AuthBase
from typing import NamedTuple
from dataclasses import dataclass

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
class Subscription:
    subscriptionId: int

    @staticmethod
    def from_dict(d):
        return Subscription(d['subscriptionId'])

def process_Subscription(env: Environment, subscriptionIds, targetTask) -> bool:
    url = '{}/api//resync-failed-tasks'.format(env.github_for_jira_url)
    
    response = session.post(url,
      auth=env.github_for_jira_auth,
      json={
        "subscriptionsIds": subscriptionIds,
        "targetTasks": [targetTask]
      },
      headers = {"Content-Type": "application/json"})

    LOG.info("Response status %s" , response.status_code)
    LOG.info("Response text %s" , response.text)
    
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--env', choices=('dev', 'staging', 'prod'), required=True)
    parser.add_argument('--batchsize', default=100, type=int)
    parser.add_argument('--input', type=argparse.FileType('r'), required=True)
    parser.add_argument('--task', choices=("dependabotAlert", "secretScanningAlert", "codeScanningAlert"), required=True)
    parser.add_argument('--sleep', type=int, help='How long to wait between requests in seconds', required=True)
    parser.add_argument('--level', default='INFO', choices=('INFO', 'ERROR', 'WARNING', 'DEBUG', 'CRITICAL'))
    args = parser.parse_args()

    configure_logging(level=args.level)

    env = create_environment(args.env)
    input_file = args.input
    targetTask = args.task

    input_reader = csv.DictReader(input_file)

    subscriptionIds = []
    for row in input_reader:
        subscription  = Subscription.from_dict(row)
        subscriptionIds.append(subscription.subscriptionId);

    LOG.info("Backfill to run for %s subscriptions", len(subscriptionIds))
    for i in range(0, len(subscriptionIds), args.batchsize):
        subscriptionIdsBatch = subscriptionIds[i:i+args.batchsize]
        LOG.info("processing batch from %s to %s", i+1, i+len(subscriptionIdsBatch));
        process_Subscription(env, subscriptionIdsBatch, targetTask)
        time.sleep(args.sleep)

if __name__ == '__main__':
    main()
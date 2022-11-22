#!/usr/bin/env python

"""
Script to set isConfigured value against Jira App properties from CSV of JiraHosts.

Takes an jirahosts.csv with jirahosts.
Keeps track of processed entries in a separate file, so that script can be stopped
and resumed without having to change the input file.

Input file format:
    jirahost
    https://jirahostname.attlassian.net

Running the script:
    $ python3 ./sync-configured-state-from-csv.py --env [ dev | staging | prod ] --sleep [ sleep-duration ] --input [ input-file-name.csv ] --output [ output-file-name.csv ]
Example
    $ python3 ./sync-configured-state-from-csv.py --env prod --sleep 10 --input jirahosts-current.csv --output output.csv

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
from dataclasses import dataclass
from requests import Request
from requests.auth import AuthBase
from typing import NamedTuple

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
            github_for_jira_url='https://github-for-jira.us-west-1.prod.atl-paas.net',
            github_for_jira_auth=create_slauth(env))
    else:
        raise ValueError(f'Invalid environment {env}')

@dataclass(frozen=True)
class Jirahost:
    jirahost: str

    @staticmethod
    def from_dict(d):
        return Jirahost(d['jirahost'])

def process_jirahost(env: Environment, jirahosts) -> bool:
    url = '{}/api/sync-configured'.format(env.github_for_jira_url)

    LOG.debug('Starting rotation of %s with url: %s', jirahosts, url)
    response = session.post(url,
      auth=env.github_for_jira_auth,
      json={
        "jirahosts": list(jirahosts)
      },
      headers = {"Content-Type": "application/json"})

    if response.ok:
        LOG.info('Sync of %s successfully started: (%s).',
                 jirahosts, response.status_code)
        return 'success'
    else:
        LOG.error('Sync of %s failed (%s): %s',
                  jirahosts, response.status_code, response.text)
        return 'error'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--env', choices=('dev', 'staging', 'prod'), required=True)
    parser.add_argument('--batchsize', default=10, type=float, help='How many jirahosts to process each iteration')
    parser.add_argument('--input', type=argparse.FileType('r'), required=True)
    parser.add_argument('--output', type=argparse.FileType('a+'), required=True)
    parser.add_argument('--sleep', type=float, help='How long to wait between requests in seconds', required=True)
    parser.add_argument('--level', default='INFO', choices=('INFO', 'ERROR', 'WARNING', 'DEBUG', 'CRITICAL'))
    args = parser.parse_args()

    configure_logging(level=args.level)

    env = create_environment(args.env)
    input_file = args.input
    output_file = args.output

    processed = set()
    output_file.seek(0)
    output_reader = csv.DictReader(output_file, fieldnames=['jirahost'])
    for row in output_reader:
        processed.add(Jirahost.from_dict(row))
    output_writer = csv.DictWriter(output_file, fieldnames=['jirahost', 'status'])
    input_reader = csv.DictReader(input_file, fieldnames=['jirahost'])

    jirahosts = []
    for row in input_reader:
        jirahost = Jirahost.from_dict(row)
        if jirahost.jirahost == 'jirahost':
            # Skip header
            continue

        if jirahost in processed:
            # Skip already processed
            continue

        jirahosts.append(int(jirahost.jirahost))

    for i in range(0, len(jirahosts), args.batchsize):
        jirahostBatch = jirahosts[i:i+args.batchsize]
        print("processing batch: ", jirahostBatch)
        status = process_jirahost(env, jirahostBatch)
        if status == 'error':
            LOG.error('Stopping due to error. To skip a particular jirahost, add a row to output file')
            sys.exit(1)

        processed.add(jirahost)
        for jirahostEntry in jirahostBatch:
            output_writer.writerow({'jirahost': jirahostEntry, 'status': status})

        time.sleep(args.sleep)

if __name__ == '__main__':
    main()

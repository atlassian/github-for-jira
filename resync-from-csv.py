#!/usr/bin/env python

"""
Script to trigger secret rotation for installations in dss-secrets-store.

Takes an installations.csv with cloud_id,workspace_uuid rows and triggers rotation for each installation.
Keeps track of processed entries in a separate file, so that script can be stopped
and resumed without having to change the input file.

Input file format:

    cloud_id,workspace_uuid
    59fd52f3-b8d7-44f7-9441-01ab70fab45d,{20f0af8c-1b1a-462b-80d7-36818edaaa84}

Running the script:

    $ ./rotate_installations.py --env staging --sleep 1 --input installations.csv --output output.csv

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
        audience=f'dss-secrets-store',
        group=f'micros-sv--dss-secrets-store-dl-admins',
        environment=env
    )


class Environment(NamedTuple):
    secrets_url: str
    secrets_auth: object


def create_environment(env: str) -> Environment:
    if env == 'dev':
        return Environment(
            secrets_url='https://dss-secrets-store.ap-southeast-2.dev.atl-paas.net',
            secrets_auth=create_slauth(env))
    elif env == 'staging':
        return Environment(
            secrets_url='https://dss-secrets-store.us-east-1.staging.atl-paas.net',
            secrets_auth=create_slauth(env))
    elif env == 'prod':
        return Environment(
            secrets_url='https://dss-secrets-store.prod.atl-paas.net',
            secrets_auth=create_slauth(env))
    else:
        raise ValueError(f'Invalid environment {env}')


@dataclass(frozen=True)
class Installation:
    cloud: str
    workspace: str

    @staticmethod
    def from_dict(d):
        return Installation(d['cloud_id'], d['workspace_uuid'])


def process_installation(env: Environment, installation: Installation) -> bool:
    url = '{}/api/internal/installations/rotate/cloudid/{}/bitbucket/workspaceuuid/{}'.format(
        env.secrets_url, installation.cloud, installation.workspace)

    LOG.debug('Starting rotation of %s with url: %s', installation, url)
    response = session.post(url, auth=env.secrets_auth)
    if response.ok:
        LOG.info('Rotation of %s was successful (%s).',
                 installation, response.status_code)
        return 'success'
    elif response.status_code == 404:
        LOG.info('Rotation of %s returned not found, skipping (%s).',
                 installation, response.status_code)
        return 'not_found'
    else:
        LOG.error('Rotation of %s failed (%s): %s',
                  installation, response.status_code, response.text)
        return 'error'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--env', choices=('dev', 'staging', 'prod'), required=True)
    parser.add_argument('--input', type=argparse.FileType('r'), required=True)
    parser.add_argument('--output', type=argparse.FileType('a+'), required=True)
    parser.add_argument('--sleep', type=float,
                        help='How long to wait between requests in seconds', required=True)
    parser.add_argument('--level', default='INFO', choices=('INFO', 'ERROR', 'WARNING', 'DEBUG', 'CRITICAL'))
    args = parser.parse_args()

    configure_logging(level=args.level)

    env = create_environment(args.env)
    input_file = args.input
    output_file = args.output

    processed = set()
    output_file.seek(0)
    output_reader = csv.DictReader(output_file, fieldnames=['cloud_id', 'workspace_uuid'])
    for row in output_reader:
        processed.add(Installation.from_dict(row))

    output_writer = csv.DictWriter(output_file, fieldnames=['cloud_id', 'workspace_uuid', 'status'])

    input_reader = csv.DictReader(input_file, fieldnames=['cloud_id', 'workspace_uuid'])

    for row in input_reader:
        installation = Installation.from_dict(row)
        if installation.cloud == 'cloud_id' and installation.workspace == 'workspace_uuid':
            # Skip header
            continue

        if installation in processed:
            # Skip already processed
            continue

        status = process_installation(env, installation)
        if status == 'error':
            LOG.error('Stopping due to error. To skip a particular installation, add a row to output file')
            sys.exit(1)

        processed.add(installation)
        output_writer.writerow({'cloud_id': installation.cloud, 'workspace_uuid': installation.workspace, 'status': status})

        time.sleep(args.sleep)


if __name__ == '__main__':
    main()

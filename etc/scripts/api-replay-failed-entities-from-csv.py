
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

LOG = logging.getLogger(__name__)

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


def main():
    print("main function....")

if __name__ == '__main__':
    main()
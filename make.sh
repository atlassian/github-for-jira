#!/bin/bash


APP=mya-jira-plugin
ECR_APP=${APP}

# You need to override any of the functions {pre_run,unit_test,build,deploy}
# to customize.
# This is required if you want to unit tests

unit_test(){
  #Should we run unit tests, double check?
  if [[ "${UNIT_TEST}" == true ]]; then
    echo "Running Unit Tests"

    #When you run docker inside docker you must think of paths from the actual
    # docker server and not the inside perspective. In our case jenkins home dir
    # /var/jenkins_home is a persistent volume located under /opt/efs/jenkins_home
    # on the parent docker server.  So if we are running in jenkins we must do
    # a search and replace on the path when we tell docker to mount a dir
    # this way it knows where that dir REALLY is

    #Why rebuild again when we already have an image, lets test the image
    #yarn --network-timeout --production=false 1000000 && touch .env
    #yarn run build
    #yarn run test

    if [ ! -z ${JENKINS_REAL_HOME} ]; then
      ARTIFACT_DIR="${PWD/var/opt\/efs}/artifacts"
    else
      ARTIFACT_DIR=artifacts
    fi

    # If our local mount path doesn't exists then make it
    if [ ! -d "${PWD}/artifacts" ]; then
      mkdir -p "${PWD}/artifacts"
    fi
    TEST_PREFIX="docker run \
      --rm \
      --name ${APP}-$$ \
      -e NODE_ENV=test \
      -v ${ARTIFACT_DIR}:/usr/local/src/reports \
      -v ${ARTIFACT_DIR}:/usr/local/src/coverage \
      ${APP}:${GIT_SHA}"

    ${TEST_PREFIX} yarn run test

    if [[ $? != 0 ]]; then
      echo "Unit test failed!"
      exit 99
    fi
  fi
}


## Now Lets run the Mya Common CICD
# See https://hiremya.atlassian.net/wiki/spaces/DEVOPS/pages/324894811/Mya+Common+CICD
# For Details on how to use

FUNCS_SCRIPT=./.make_common.sh
FUNCS_URL='s3://mya-devops-us-east-1/jenkins/make_common.sh'

if [ ! -f ${FUNCS_SCRIPT} ]; then
  echo -e "#### Begin Fetch Common Scripts `date +%X`: ####\n"
    aws s3 cp ${FUNCS_URL} ${FUNCS_SCRIPT} --region=us-east-1 --sse=aws:kms 2>&1 > /dev/null|| \
    aws s3 cp ${FUNCS_URL/us-east-1/us-west-2} ${FUNCS_SCRIPT} --region=us-west-2 --sse=aws:kms 2>&1 > /dev/null

    if [[ $? != 0 ]]; then
      echo "Authentication failed, please run aws_get_creds first!"
      exit 99
    fi

  echo -e "#### End Fetch Common Scripts `date +%X`: ####\n"
fi

source ${FUNCS_SCRIPT}

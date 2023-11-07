pipeline {
    agent any
    stages {
        stage('Trigger Bitbucket Pipeline') {
            steps {
                script {
                    def bitbucketUrl = 'https://api.bitbucket.org/2.0/repositories/atlassian/jkat-test-jenkins-integration/pipelines'
                    def credentialsId = 'mock-bb-secret'
                    def branch = 'master' // Specify the branch to build

                    def accessToken = withCredentials([usernamePassword(credentialsId: credentialsId, passwordVariable: 'BITBUCKET_TOKEN')]) {
                        return BITBUCKET_TOKEN
                    }

                    def payload = """
                    {
                        "target": {
                            "type": "pipeline_ref_target",
                            "ref_name": "${branch}",
                            "ref_type": "branch"
                        }
                    }
                    """

                    def response = httpRequest(
                        url: bitbucketUrl,
                        authentication: "Bearer ${accessToken}",
                        contentType: 'APPLICATION_JSON',
                        httpMode: 'POST',
                        requestBody: payload
                    )

                    if (response.status == 200) {
                        echo "Bitbucket pipeline build triggered successfully!"
                    } else {
                        error "Failed to trigger Bitbucket pipeline build. Error: ${response.status} - ${response.content}"
                    }
                }
            }
        }
    }
}

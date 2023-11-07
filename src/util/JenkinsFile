pipeline {
    agent any
    stages {
        stage('Trigger Bitbucket Pipeline') {
            steps {
                script {
                    def bitbucketUrl = 'https://api.bitbucket.org/2.0/repositories/atlassian/github-for-jira-deployment/pipelines/'
                    def credentialsId = 'bitbucket-credentials'
                    def branch = 'master' // Specify the branch to build

                    def payload = """
                    {
                        "target": {
                            "ref_type": "branch",
                            "type": "pipeline_ref_target",
                            "ref_name": "${branch}"
                        }
                    }
                    """

                    withCredentials([usernamePassword(credentialsId: credentialsId, usernameVariable: 'BITBUCKET_USERNAME', passwordVariable: 'BITBUCKET_PASSWORD')]) {
                        def response = httpRequest(
                            url: bitbucketUrl,
                            authentication: "${BITBUCKET_USERNAME}:${BITBUCKET_PASSWORD}",
                            contentType: 'application/json',
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
}

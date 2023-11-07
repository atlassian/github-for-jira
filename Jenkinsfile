
pipeline {
    agent any
    stages {
        stage('Trigger Bitbucket Pipeline') {
            steps {
                script {
                    def bitbucketUrl = 'https://api.bitbucket.org/2.0/repositories/atlassian/jkat-test-jenkins-integration/pipelines'
                    def branch = 'master' // Specify the branch to build

                    withCredentials([string(credentialsId: 'bb-access-token', variable: 'accessToken')]) {
                        def payload = """
                        {
                            "target": {
                                "type": "pipeline_ref_target",
                                "ref_name": "${branch}",
                                "ref_type": "branch"
                            }
                        }
                        """

                        sh """
                        curl --request POST \\
                        --url '${bitbucketUrl}' \\
                        --header 'Authorization: Bearer ${accessToken}' \\
                        --header 'Accept: application/json' \\
                        --header 'Content-Type: application/json' \\
                        --data '${payload}'
                        """
                    }
                }
            }
        }
    }
}

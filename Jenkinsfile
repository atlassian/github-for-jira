pipeline {
    agent any
    stages {
        stage('Trigger Bitbucket Pipeline') {
            steps {
                script {
                    def bitbucketUrl = 'https://api.bitbucket.org/2.0/repositories/atlassian/jkat-test-jenkins-integration/pipelines'
                    def branch = 'master' // Specify the branch to build




                     withCredentials([usernamePassword(
                        credentialsId: 'mock-bb-secret', // Specify your credentials ID
                        usernameVariable: 'USERNAME', // Variable to store the username
                        passwordVariable: 'PASSWORD' // Variable to store the password
                    )]) {

    
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
                            authentication: "Bearer ${PASSWORD}",
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
}

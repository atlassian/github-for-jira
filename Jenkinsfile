
pipeline {
    agent any
    stages {
        stage('Trigger Bitbucket Pipeline') {
            steps {
                script {
                    def bitbucketUrl = 'https://api.bitbucket.org/2.0/repositories/atlassian/jkat-test-jenkins-integration/pipelines'
                    def accessToken = 'ATCTT3xFfGN0jJ8oBiz5Fnjwd_JQj8o-rB-Dbii1FU2QdkNz5PISbCevCGhC_mtGx_MeYAvGwftDoglWnyzz_AFaS4dzP2tWic2DZZ1ci1v8NLz0y7v0_tw9kkw3jZrZ0mGHjNBIKv883gSjyzEInKPWMWMzBMMllunCeImNtnAMTldUkC8QaOE=F74D0B83'
                    def branch = 'master' // Specify the branch to build

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
                        authentication: accessToken,
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

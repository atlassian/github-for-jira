const https = require('https');

const pipelinesURL = 'https://api.bitbucket.org/2.0/repositories/atlassian/github-for-jira-deployment/pipelines/';
const autoDeployUsername = process.env.AUTO_DEPLOY_USERNAME;
const autoDeployToken = process.env.AUTO_DEPLOY_TOKEN;

exports.handler = async function (event, context) {

    if (!process.env.AUTO_DEPLOY_ENABLED) {
        console.log('Auto Deploying disabled');
        return;
    }
    if (!autoDeployUsername) {
        console.error('No auto deploy username was provided!');
        return;
    }
    if (!autoDeployToken) {
        console.error('No auto deploy token was provided!');
        return;
    }

    try {
        const versionURL = `${process.env.PROD_URL}/version`;
        const mainBranchURL = 'https://api.github.com/repos/atlassian/github-for-jira/branches/main';

        const deployedCommitSHA = (await getRequest(versionURL)).commit;
        const mainCommitSHA = (await getRequest(mainBranchURL)).commit.sha;

        if (deployedCommitSHA !== mainCommitSHA && ! await isPipelineRunning()) {
            console.log('Changes found, starting deployment...');

            const body = {
                "target": {
                    "type": "pipeline_ref_target",
                    "ref_type": "branch",
                    "ref_name": "master",
                    "selector": { "type": "custom", "pattern": "deploy-to-prod" }
                }
            };

            const pipelineResponse = await postRequest(
                pipelinesURL,
                body,
                { 'Authorization': 'Basic ' + new Buffer(autoDeployUsername + ':' + autoDeployToken).toString('base64') }
            );
            if (pipelineResponse.type === 'pipeline') {
                console.log(`Build# ${pipelineResponse?.build_number} triggered successfully!`);
            } else {
                throw new Error(JSON.stringify(pipelineResponse));
            }
        } else {
            console.log('No changes found or pipeline already running, skipping deployment!');
        }
    } catch (e) {
        console.error('Error: ', e);
    }
};

// Returns true if any pipline is running for deployment to stage/prod
async function isPipelineRunning() {
    const url = `${pipelinesURL}?page=1&pagelen=20&sort=-created_on`;
    const pipelines = await getRequest(url, {
        'Authorization': 'Basic ' + new Buffer(autoDeployUsername + ':' + autoDeployToken).toString('base64')
    });
    const runningPipelines = pipelines.values.filter((pipeline) => {
        return (pipeline?.target?.selector?.type === "custom"
            && (pipeline?.target?.selector?.pattern === "deploy-to-prod"
                || pipeline?.target?.selector?.pattern === "deploy-to-staging")
            && pipeline?.state?.stage?.name.toLowerCase() === "running");
    });
    console.log(`${runningPipelines.length} pipeline(s) running!`);
    return runningPipelines.length > 0;

}

function getRequest(url, headers = {}) {
    const options = {
        headers: {
            "User-Agent": "Auto-Deployment-Lambda-GitHub-for-Jira-App",
            ...headers
        }
    };
    return new Promise((resolve, reject) => {
        const req = https.get(url, options, res => {
            let rawData = '';

            res.on('data', chunk => {
                rawData += chunk;
            });

            res.on('end', () => {
                try {
                    resolve(JSON.parse(rawData));
                } catch (err) {
                    reject(new Error(err));
                }
            });
        });

        req.on('error', (err) => {
            reject(new Error(err));
        });
    });
}

function postRequest(url, body, headers = {}) {
    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...headers
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(url, options, res => {
            let rawData = '';

            res.on('data', chunk => {
                rawData += chunk;
            });

            res.on('end', () => {
                try {
                    resolve(JSON.parse(rawData));
                } catch (err) {
                    reject(new Error(err));
                }
            });
        });

        req.on('error', err => {
            reject(new Error(err));
        });

        req.write(JSON.stringify(body));
        req.end();
    });
}
const https = require('https');

exports.handler = async function (event, context) {
    if (!process.env.AUTO_DEPLOY_ENABLED) {
        console.log('Auto Deploying disabled');
        return;
    }

    try {
        const autoDeployUsername = process.env.AUTO_DEPLOY_USERNAME;
        const autoDeployToken = process.env.AUTO_DEPLOY_TOKEN;

        if (!autoDeployUsername) {
            console.error('No auto deploy username was provided!');
        }
        if (!autoDeployToken) {
            console.error('No auto deploy token was provided!');
        }

        const versionURL = `${process.env.PROD_URL}/version`;
        const mainBranchURL = 'https://api.github.com/repos/atlassian/github-for-jira/branches/main';

        const deployedCommitSHA = (await getRequest(versionURL)).commit;
        const mainCommitSHA = (await getRequest(mainBranchURL)).commit.sha;

        if (deployedCommitSHA !== mainCommitSHA) {
            console.log('Changes found, starting deployment...');

            const pipelinesURL = 'https://api.bitbucket.org/2.0/repositories/atlassian/github-for-jira-deployment/pipelines/';
            const body = {
                "target": {
                    "type": "pipeline_ref_target",
                    "ref_type": "branch",
                    "ref_name": "master",
                    "selector": {"type": "custom", "pattern": "deploy-to-prod"}
                }
            };

            await postRequest(
                pipelinesURL,
                body,
                {'Authorization': 'Basic ' + new Buffer(autoDeployUsername + ':' + autoDeployToken).toString('base64')}
            );
            console.log('Pipeline triggered successfully!');
        } else {
            console.log('No changes found, skipping deployment!');
        }
    } catch (e) {
        console.error('Error: ', e);
    }
};

function getRequest(url) {
    const options = {
        headers: {
            "User-Agent": "Auto-Deployment-Lambda-GitHub-for-Jira-App"
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

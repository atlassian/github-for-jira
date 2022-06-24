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
        // TODO: Need to store in Microscope
        const mainBranchURL = 'https://api.github.com/repos/atlassian/github-for-jira/branches/main';

        const deployedCommitSHA = (await getRequest(versionURL)).commit;
        const mainCommitSHA = (await getRequest(mainBranchURL)).commit.sha;

        if (deployedCommitSHA !== mainCommitSHA) {
            console.log('Changes found, starting deployment...');

            // TODO: Need to update this URL with the actual one and store in Microscope
            const pipelinesURL = 'https://api.bitbucket.org/2.0/repositories/harminder5/bitbucket-pipeline/pipelines/';
            const body = {
                "target": {
                    "type": "pipeline_ref_target",
                    "ref_type": "branch",
                    "ref_name": "master",
                    // TODO: Change the pattern to the actual one from GH4J
                    "selector": {"type": "custom", "pattern": "deployment-to-prod"}
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
            "User-Agent": "GitHub-for-Jira-App"
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

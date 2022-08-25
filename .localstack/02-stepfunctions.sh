# Role
awslocal iam create-role --role-name backfill --assume-role-policy-document file:///tmp/stepfunctions/backfill-role.json

# Step functions
awslocal stepfunctions create-state-machine --name backfill --role-arn "arn:aws:iam::000000000000:role/backfill" --definition file:///tmp/stepfunctions/backfill-state.json

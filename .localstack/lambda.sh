awslocal lambda create-function --function-name hello-world \
    --code S3Bucket="__local__",S3Key="/tmp/lambdas/helloworld" \
    --handler index.handler \
    --runtime nodejs16.x \
    --role hello-world

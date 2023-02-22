#!/usr/bin/env bash

# Installing utility to convert yaml file to json
if ! [ -x "$(command -v yq)" ]; then
  echo "yq utility missing, installing..."
  curl -o /usr/bin/yq -L https://github.com/mikefarah/yq/releases/latest/download/yq_linux_amd64 && chmod +x /usr/bin/yq
fi

echo "Converting api gateway yaml to json..."
yq -o=json '.' /api-gateway.yml > /api-gateway.json
echo "Replacing api gateway variables..."
sed -i 's/{{WebhooksQueueRegion}}/us-west-1/' /api-gateway.json
sed -i 's/{{AccountNumber}}/000000000000/' /api-gateway.json
sed -i 's/{{WebhooksQueueName}}/webhooks/' /api-gateway.json
sed -i 's/credentials: "{{RoleARN}}"//' /api-gateway.json
sed -i 's/{{RoleARN}}/arn:aws:iam::000000000000:role\/fake-role/' /api-gateway.json
sed -i 's/https:\/\/{{ServerHost}}/http:\/\/app:8080/' /api-gateway.json
sed -i 's/{{ServerHost}}/app:8080/' /api-gateway.json
#echo "api gateway json contents:"
#cat /api-gateway.json

# Create REST API with static API ID of 'gateway'
awslocal apigateway create-rest-api --name gateway --tags '{"_custom_id_":"gateway"}'
# Import openapi definition to the gateway API
awslocal apigateway put-rest-api --rest-api-id gateway --body 'file:///api-gateway.json'

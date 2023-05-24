FROM node:14.21-alpine3.16 as build

# adding python for node-gyp
RUN apk add g++ make python3

# adding to solve vuln
RUN apk add --update --upgrade busybox libretls openssl zlib curl

# Update SSL certs
RUN apk add --update --upgrade --no-cache ca-certificates
RUN update-ca-certificates

# For debugging curl command
RUN apk add curl

#
# Sometimes Node.js requires intermediate certificates for some authorities, which means SSL won't work out-of-the-box
# for some GHE customers. Details: https://stackoverflow.com/questions/31673587/error-unable-to-verify-the-first-certificate-in-nodejs .
#       "It's because browsers tend to complete the chain if it’s not sent from the server." (c) :rage:
#
# If you think you have fixed the issue, please write a script to make sure you are not breaking prod servers from GitHubServerApps
# and run within the app using e.g. anonymous client. Those servers that were not returning SSL errors (e.g. when using "fetch()") shouldn't
# start erroring out.
#
RUN mkdir certs

# SectigoRSADomainValidationSecureServerCA
RUN curl -o certs/sertigo-intermediate.crt http://crt.sectigo.com/SectigoRSADomainValidationSecureServerCA.crt
RUN openssl x509 -in certs/sertigo-intermediate.crt -out certs/sertigo-intermediate.pem -outform PEM
RUN openssl verify -CAfile /etc/ssl/cert.pem certs/sertigo-intermediate.pem

# TODO add more

RUN cat certs/*.pem > certs/ca-bundle.pem
ENV NODE_EXTRA_CA_CERTS=/certs/ca-bundle.pem

############

COPY . /app
WORKDIR /app

# Installing packages
RUN yarn install --frozen-lockfile

CMD ["yarn", "start"]

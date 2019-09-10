FROM 861281107445.dkr.ecr.us-west-2.amazonaws.com/mya-node-base:latest

ARG APP_VERSION
ENV APP_VERSION=${APP_VERSION} \
  PORT=8000 \
  NODE_ENV=production

# set working directory
ADD . /usr/local/src
WORKDIR /usr/local/src

# build project
RUN yarn --production=false --network-timeout 1000000 && touch .env
RUN yarn run build

# set create logs and set owner and group
RUN mkdir -p logs && \
  chown -R node:node ./logs
RUN chown -R node:node /usr/local/src
RUN rm -Rf /usr/share/licenses/* && \
    yum clean all && \
    rm -rf /var/cache/yum /root/.cache/* /usr/share/doc/* /usr/share/man/* && \
    rm -Rf /usr/local/share/.cache

# set current user
USER node

# run project
CMD ["./npm_start.sh"]

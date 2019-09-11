FROM 861281107445.dkr.ecr.us-west-2.amazonaws.com/mya-node-base:latest

ARG APP_VERSION
ARG BUILD_TIME
ENV APP_VERSION=${APP_VERSION} \
    BUILD_TIME=${BUILD_TIME} \
    PORT=8000 \
    PATH=/usr/local/bin:$PATH \
    LANG=C.UTF-8 \
    PYTHONUNBUFFERED=1 \
    NODE_ENV=production

RUN groupadd --gid 1100 python \
  && useradd --uid 1100 --gid python --shell /bin/bash --create-home python

RUN yum groupinstall -y "Development Tools"
RUN amazon-linux-extras install epel -y
RUN yum -y install python3 python3-pip

RUN cd /usr/local/bin \
	&& ln -s /usr/bin/pip3 pip \
	&& ln -s /usr/bin/pydoc3 pydoc \
	&& ln -s /usr/bin/python3 python

# set working directory
RUN pip3 install awscli
ADD . /usr/local/src
WORKDIR /usr/local/src

# build project
RUN npm install
RUN npm install -g nodemon

# set create logs and set owner and group
RUN mkdir -p logs && \
  chown -R node:node ./logs
RUN chown -R node:node /usr/local/src
RUN rm -Rf /usr/share/licenses/* && \
    yum groupremove -y "Development tools" && yum clean all && \
    rm -rf /var/cache/yum /root/.cache/* /usr/share/doc/* /usr/share/man/* && \
    rm -Rf /usr/local/share/.cache

# set current user
USER node

# run project
CMD ["./npm_start.sh"]

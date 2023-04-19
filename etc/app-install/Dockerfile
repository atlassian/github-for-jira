FROM alpine:latest as build

RUN apk --no-cache add curl jq

COPY ./etc/app-install/app-install.sh ./app/app-install.sh
WORKDIR /app

CMD ["sh", "app-install.sh"]

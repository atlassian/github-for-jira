# Update the Postgres configuration using the Heroku application environment variable
if [ -n "$DATABASE_URL" ]; then
  POSTGREGEX='^postgres://([^:]+):([^@]+)@([^:]+):([^/]+)/(.*)$'
  if [[ $DATABASE_URL =~ $POSTGREGEX ]]; then
    sed -i "s/<YOUR HOSTNAME>/${BASH_REMATCH[3]}/" "$DD_CONF_DIR/conf.d/postgres.d/conf.yaml"
    sed -i "s/<YOUR USERNAME>/${BASH_REMATCH[1]}/" "$DD_CONF_DIR/conf.d/postgres.d/conf.yaml"
    sed -i "s/<YOUR PASSWORD>/${BASH_REMATCH[2]}/" "$DD_CONF_DIR/conf.d/postgres.d/conf.yaml"
    sed -i "s/<YOUR PORT>/${BASH_REMATCH[4]}/" "$DD_CONF_DIR/conf.d/postgres.d/conf.yaml"
    sed -i "s/<YOUR DBNAME>/${BASH_REMATCH[5]}/" "$DD_CONF_DIR/conf.d/postgres.d/conf.yaml"
  fi
fi

# Update the Redis configuration using the Heroku application environment variable
if [ -n "$REDIS_URL" ]; then
  REDISREGEX='^redis://([^:]+):([^@]+)@([^:]+):([^/]+)/(.*)$'
  if [[ $REDIS_URL =~ $REDISREGEX ]]; then
    sed -i "s/<REDIS HOSTNAME>/${BASH_REMATCH[3]}/" "$DD_CONF_DIR/conf.d/redisdb.d/conf.yaml"
    sed -i "s/<REDIS PORT>/${BASH_REMATCH[4]}/" "$DD_CONF_DIR/conf.d/redisdb.d/conf.yaml"
    sed -i "s/<REDIS PASSWORD>/${BASH_REMATCH[2]}/" "$DD_CONF_DIR/conf.d/redisdb.d/conf.yaml"
  fi
fi

#!/bin/bash

###############################################################################
# Read command line arguments

ENV=production
VERBOSE=0

DOSEED=0
SEED=""

function readopts {
  while ((OPTIND<=$#)); do
    if getopts ":stdpvh" opt; then
      case $opt in
        v) VERBOSE=1;;
        d) ENV="development";;
        p) ENV="production";;
        t) ENV="test";;
        s) DOSEED=1;;
        h) echo "Usage: start.sh [-d] [-p] [-t] [-s [<seed-name>]]"
           echo "   -d : start in development mode"
           echo "   -p : start in production mode"
           echo "   -t : start in test mode"
           echo "   -s : seed using a default seed or the given one"
           exit;;
        *) ;;
      esac
    else
        let OPTIND++
    fi
  done
  let OPTIND=0
  while ((OPTIND<=$#)); do
    if getopts ":s:" opt; then
      case $opt in
        s) DOSEED=1
           SEED=$OPTARG;;
        *) ;;
      esac
    else
        let OPTIND++
    fi
  done
}
OPTIND=1
readopts "$@"

###############################################################################
# Set environment variables

if [ $ENV == "production" ]; then
  export POSTGRES_CONN=$SUBSTANCE_PRODUCTION_POSTGRES_CONN
  REDIS_CONF=$SUBSTANCE_PRODUCTION_REDIS_CONF
  export SUBSTANCE_REDIS_PORT=6390
  export PORT=4000
elif [ $ENV == "development" ]; then
  export POSTGRES_CONN=$SUBSTANCE_DEVELOPMENT_POSTGRES_CONN
  REDIS_CONF=$SUBSTANCE_DEVELOPMENT_REDIS_CONF
  export SUBSTANCE_REDIS_PORT=6391
  export PORT=3000
elif [ $ENV == "test" ]; then
  export POSTGRES_CONN=$SUBSTANCE_TEST_POSTGRES_CONN
  REDIS_CONF=$SUBSTANCE_TEST_REDIS_CONF
  export SUBSTANCE_REDIS_PORT=6392
  export PORT=3001
else
  echo "Unsupported environment." && exit -1
fi

PID_FILE="/tmp/substance_""$ENV""_redis.pid"

export NODE_ENV=$ENV

if [ $VERBOSE == 1 ]; then
  echo "NODE_ENV: $NODE_ENV"
  echo "DOSEED: $DOSEED"
  echo "SEED: $SEED"
fi

###############################################################################
# Start redis server (keeping PID to kill afterwards)
echo "Starting redis-server with configuraiton $REDIS_CONF"
redis-server $REDIS_CONF

###############################################################################
# Start node
if [ $DOSEED == 1 ]; then
  node server --seed $SEED
else
  node server
fi

###############################################################################
# kill redis server

PID=$(cat $PID_FILE)
echo "Closing redis-server: $PID"
kill -9 $PID

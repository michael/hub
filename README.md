Substance Hub
===

We're using OSX for development, but this setup should work on Linux too. At least for the hub.

## Prerequisites


- Node.js 0.8.x
- Redis 2.6.x
- Postgres 9.2.x
- PCRE (`sudo port install pcre`)
- Automake (really?) (`sudo port install automake`)
- Autoconf (`sudo port install autoconf`)


## Setup Dev Environment

Clone the Substance Mothership

```bash
$ git clone https://github.com/michael/substance.git
```

Execute the Substance update script. It sets up the whole environment

```bash
$ cd substance
$ ./update.sh -c # performs a clean build
```

Navigate to the Hub Repository

```bash
$ cd hub
```

## Setup Database Environment

Initialize your Postgres Database by executing:

```bash
$ psql postgres -p 5432 -h localhost -f postgres.init
```

Put this into your `~/.profile` and adapt to your needs:

```bash
export SUBSTANCE_PRODUCTION_POSTGRES_CONN="postgres://substance:substance@localhost:5432/substance"
export SUBSTANCE_DEVELOPMENT_POSTGRES_CONN="postgres://substance:substance@localhost:5432/substance_development"
export SUBSTANCE_TEST_POSTGRES_CONN="postgres://substance:substance@localhost:5432/substance_test"

export SUBSTANCE_PRODUCTION_REDIS_CONF="$HOME/substance_production_redis.conf"
export SUBSTANCE_DEVELOPMENT_REDIS_CONF="$HOME/substance_development_redis.conf"
export SUBSTANCE_TEST_REDIS_CONF="$HOME/substance_test_redis.conf"
```

Please use the following ports for your Redis configurations:

- Port 6390 - Production
- Port 6391 - Development
- Port 6392 - Test


## Start the hub

```bash
./start.sh -d -s # Start in development env and apply default seed
```

### Setup Redis

Start redis (by using the redis.conf in the repository, it uses port 6380 for the docstore)

```bash
localhost:hub michael $ redis-server redis.conf
```

## Run the tests

1. Start the Hub in Test Mode

   ```bash
   ./start.sh -t
   ```

2. Start the Composer (`composer/build/app/osx/Substance.app`) and press `ctrl + alt + t`

   Now playing around with the test suite should be self-explanatory.

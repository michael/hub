Substance Hub
===

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
$ ./update.sh
```

Navigate to the Hub Repository

```bash
$ cd hub
```

## Setup Database Environment

Initialize your Postgres Database by executing:

```bash
$ psql -p 5432 -h localhost -f postgres.init
```

Put this into your `~/.profile` and adapt to your needs:

```bash
-- export SUBSTANCE_PRODUCTION_POSTGRES_CONN="postgres://substance:<PASSWORD>@localhost:5432/substance"
-- export SUBSTANCE_DEVELOPMENT_POSTGRES_CONN="postgres://substance:<PASSWORD>@localhost:5432/substance_development"
-- export SUBSTANCE_TEST_POSTGRES_CONN="postgres://substance:<PASSWORD>@localhost:5432/substance_test"
```


## Start the hub

```bash
./start.sh -d --seed
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

2. Start the Composer and press `ctrl + alt + t`

   Now you can play around with the test suite.

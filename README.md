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
./update.sh
```


## Setup Database Environment

Initialize your Postgres Database by executing:

```bash
cd hub
psql -p 5432 -h localhost -f postgres.init
```


Put this into your `~/.profile`:

```bash
-- export SUBSTANCE_PRODUCTION_POSTGRES_CONN="postgres://substance:<PASSWORD>@localhost:5432/substance"
-- export SUBSTANCE_DEVELOPMENT_POSTGRES_CONN="postgres://substance:<PASSWORD>@localhost:5432/substance_development"
-- export SUBSTANCE_TEST_POSTGRES_CONN="postgres://substance:<PASSWORD>@localhost:5432/substance_test"
```

### Setup Redis

Start redis (by using the redis.conf in the repository, it uses port 6380 for the docstore)

```bash
    localhost:hub michael $ redis-server redis.conf
```

make sure you have a postgres instance running and finally ...


## Run the tests

    POSTGRES_CONN="postgres://user:pwd@localhost:5432/substance" npm test

Substance Hub
===


## Prerequisites

- Install Node.js 0.8.x
- Install Redis (so you have redis-server available)
- PCRE (`sudo port install pcre`)
- Automake (really?) (`sudo port install automake`)
- Autoconf (`sudo port install autoconf`)

## Setup

Obviously...

    git clone https://github.com/michael/hub.git

then...

    cd hub

and...

    npm install # native extension substance-store is built

start redis (by using the redis.conf in the repository, it uses port 6380 for the docstore)

    localhost:hub michael $ redis-server redis.conf

make sure you have a postgres instance running and finally ...

    POSTGRES_CONN="postgres://user:pwd@localhost:5432/substance" npm start

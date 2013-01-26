Substance Hub
===


## Database setup

Just setup a new Postgres database named after your user. And create a Postgres user with your user as both name and password.

## Prerequisites

- Install Node.js 0.8.x
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

finally...

    npm start

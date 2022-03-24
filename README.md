<div align="center">
  <a href="https://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo_text.svg" width="320" alt="Nest Logo" /></a>
</div>

## Setup

```bash
$ npm install

$ cp .env.example .env
```

## ENV
* [Get Wrike Token](https://www.wrike.com/frontend/apps/index.html#api)
* [Create Slack Webhook](https://api.slack.com/messaging/webhooks)

## Running the app

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```


## Docker Dev

```bash
# Up
$ docker-compose up -d --build

# Exec app
$ docker exec -it nest-wrike-slack sh
```

## Docker Prod

```bash
# Build image
$ docker build -t nest-wrike-slack .

# Run app
$ docker run -d -v $PWD/.env:/app/.env --name nest-wrike-slack nest-wrike-slack node dist/main

# Exec app
$ docker exec -it nest-wrike-slack sh
```

FROM oven/bun:latest

WORKDIR /app

COPY . .

RUN bun install --frozen-lockfile

ENTRYPOINT ["bun", "start"]
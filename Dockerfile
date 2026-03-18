FROM oven/bun:1 AS builder
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun build ./src/index.ts --outdir ./dist --target bun

FROM gcr.io/distroless/cc-debian12
WORKDIR /app
COPY --from=builder /app/dist ./dist
ENV PORT=8080
EXPOSE 8080
CMD ["dist/index.js"]

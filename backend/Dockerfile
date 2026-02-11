FROM golang:1.24-alpine AS builder
WORKDIR /app

COPY backend/go.mod backend/go.sum ./
RUN go mod download

COPY backend/ ./
RUN go mod tidy

RUN CGO_ENABLED=0 GOOS=linux go build -o /app/doc ./cmd


FROM alpine:latest
WORKDIR /app

RUN apk add --no-cache ca-certificates

COPY --from=builder /app/doc /app/doc
COPY backend/.env /app/.env

CMD ["/app/doc"]

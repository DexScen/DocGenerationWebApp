FROM golang:1.24-alpine AS builder

WORKDIR /app

COPY /backend/go.mod /backend/go.sum ./

COPY /backend/ .

RUN CGO_ENABLED=0 GOOS=linux go build -o /app/doc ./cmd/main.go

FROM alpine:latest

COPY --from=builder /app/doc /app/
COPY backend/.env /app/

WORKDIR /app

CMD ["./doc"]
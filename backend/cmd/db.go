package main

import (
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/go-sql-driver/mysql"
)

const (
	dateLayout = "2006-01-02"
)

type connectionInfo struct {
	Host     string
	Port     int
	Username string
	DBName   string
	Password string
}

func buildDSN(info connectionInfo) string {
	cfg := mysql.Config{
		User:                 info.Username,
		Passwd:               info.Password,
		Net:                  "tcp",
		Addr:                 info.Host + ":" + strconv.Itoa(info.Port),
		DBName:               info.DBName,
		ParseTime:            true,
		AllowNativePasswords: true,
		Loc:                  time.UTC,
		Params: map[string]string{
			"charset": "utf8mb4",
		},
	}
	return cfg.FormatDSN()
}

func getEnv(key, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value
}

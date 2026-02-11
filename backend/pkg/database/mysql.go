package database

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/go-sql-driver/mysql"
)

type ConnectionInfo struct {
	Host     string
	Port     int
	Username string
	DBName   string
	Password string
}

func NewMySQLConnection(info ConnectionInfo) (*sql.DB, error) {
	cfg := mysql.Config{
		User:                 info.Username,
		Passwd:               info.Password,
		Net:                  "tcp",
		Addr:                 fmt.Sprintf("%s:%d", info.Host, info.Port),
		DBName:               info.DBName,
		ParseTime:            true,
		AllowNativePasswords: true,
		Loc:                  time.UTC,
		Params: map[string]string{
			"charset": "utf8mb4",
		},
	}
	db, err := sql.Open("mysql", cfg.FormatDSN())
	if err != nil {
		return nil, err
	}

	if err := db.Ping(); err != nil {
		return nil, err
	}

	return db, nil
}

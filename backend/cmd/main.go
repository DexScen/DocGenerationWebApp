package main

import (
	"database/sql"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/gorilla/mux"
)

func main() {
	port, _ := strconv.Atoi(getEnv("DB_PORT", "3306"))
	db, err := sql.Open("mysql", buildDSN(connectionInfo{
		Host:     getEnv("DB_HOST", "mysql"),
		Port:     port,
		Username: getEnv("DB_USER", "app"),
		DBName:   getEnv("DB_NAME", "app"),
		Password: getEnv("DB_PASSWORD", "qwerty123"),
	}))
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		log.Fatal(err)
	}

	srv := newServer(db)
	router := setupRouter(srv)

	server := &http.Server{
		Addr:    ":8080",
		Handler: router,
	}

	log.Println("Server started at:", time.Now().Format(time.RFC3339))
	if err := server.ListenAndServe(); err != nil {
		log.Fatal(err)
	}
}

func setupRouter(srv *server) http.Handler {
	router := mux.NewRouter()
	router.Use(loggingMiddleware)

	api := router.PathPrefix("/api").Subrouter()
	api.HandleFunc("/health", srv.handleHealth).Methods(http.MethodGet)

	api.HandleFunc("/auth/login", srv.handleLogin).Methods(http.MethodPost)
	api.HandleFunc("/auth/logout", srv.withAuth(srv.handleLogout)).Methods(http.MethodPost)
	api.HandleFunc("/auth/me", srv.withAuth(srv.handleMe)).Methods(http.MethodGet)

	api.HandleFunc("/users", srv.withAuth(srv.requireAdmin(srv.handleUsersList))).Methods(http.MethodGet)
	api.HandleFunc("/users", srv.withAuth(srv.requireAdmin(srv.handleUserCreate))).Methods(http.MethodPost)
	api.HandleFunc("/users/{id:[0-9]+}", srv.withAuth(srv.requireAdmin(srv.handleUserDelete))).Methods(http.MethodDelete)
	api.HandleFunc("/users/{id:[0-9]+}/role", srv.withAuth(srv.requireAdmin(srv.handleUserRoleUpdate))).Methods(http.MethodPatch)
	api.HandleFunc("/employees", srv.withAuth(srv.requireAdmin(srv.handleEmployeesList))).Methods(http.MethodGet)
	api.HandleFunc("/employees", srv.withAuth(srv.requireAdmin(srv.handleEmployeeCreate))).Methods(http.MethodPost)
	api.HandleFunc("/employees/{id:[0-9]+}", srv.withAuth(srv.requireAdmin(srv.handleEmployeeDelete))).Methods(http.MethodDelete)

	api.HandleFunc("/inspections", srv.withAuth(srv.handleInspectionsList)).Methods(http.MethodGet)
	api.HandleFunc("/inspections", srv.withAuth(srv.handleInspectionCreate)).Methods(http.MethodPost)
	api.HandleFunc("/inspections/{id:[0-9]+}", srv.withAuth(srv.handleInspectionGet)).Methods(http.MethodGet)
	api.HandleFunc("/inspections/{id:[0-9]+}", srv.withAuth(srv.handleInspectionUpdate)).Methods(http.MethodPut)
	api.HandleFunc("/inspections/{id:[0-9]+}", srv.withAuth(srv.handleInspectionDelete)).Methods(http.MethodDelete)
	api.HandleFunc("/inspections/{id:[0-9]+}/export/docx", srv.withAuth(srv.handleInspectionDocx)).Methods(http.MethodGet)
	api.HandleFunc("/verification-areas", srv.withAuth(srv.handleVerificationAreasGet)).Methods(http.MethodGet)
	api.HandleFunc("/verification-areas", srv.withAuth(srv.handleVerificationAreasUpsert)).Methods(http.MethodPut)
	api.HandleFunc("/dadata/organization", srv.withAuth(srv.handleDadataOrganization)).Methods(http.MethodPost)

	return router
}

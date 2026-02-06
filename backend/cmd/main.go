package main

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/mux"
	"github.com/lib/pq"
)

const (
	dateLayout = "2006-01-02"
)

type server struct {
	db       *sql.DB
	sessions *sessionStore
}

type sessionStore struct {
	mu       sync.RWMutex
	sessions map[string]user
}

type user struct {
	ID       int    `json:"id"`
	Name     string `json:"name"`
	Login    string `json:"login"`
	Password string `json:"password,omitempty"`
	Role     string `json:"role"`
}

type actPayload struct {
	CreatedBy    string          `json:"created_by"`
	Organization organizationDTO `json:"organization"`
	Head         headDTO         `json:"head"`
	Inspection   inspectionDTO   `json:"inspection"`
}

type organizationDTO struct {
	Ogrn      string     `json:"ogrn"`
	Name      string     `json:"name"`
	ShortName string     `json:"shortName"`
	Address   addressDTO `json:"address"`
}

type addressDTO struct {
	LegalAddress  string `json:"legalAddress"`
	PostalAddress string `json:"postalAddress"`
}

type headDTO struct {
	Role           string `json:"role"`
	NamePatronymic string `json:"namePatronymic"`
	LastName       string `json:"lastName"`
	LastNameTo     string `json:"lastNameTo"`
}

type inspectionDTO struct {
	FormType       string    `json:"formType"`
	MzOrder        orderDTO  `json:"mzOrder"`
	Number         string    `json:"number"`
	Period         periodDTO `json:"period"`
	Letter         letterDTO `json:"letter"`
	AddressNoIndex string    `json:"addressNoIndex"`
	Representative string    `json:"representative"`
	Inspectors     []string  `json:"inspectors"`
	Signatures     []string  `json:"signatures"`
}

type orderDTO struct {
	Number string `json:"number"`
	Date   string `json:"date"`
}

type periodDTO struct {
	StartDate string `json:"startDate"`
	EndDate   string `json:"endDate"`
	Days      string `json:"days"`
}

type letterDTO struct {
	NumberLeft  string `json:"numberLeft"`
	NumberRight string `json:"numberRight"`
	Date        string `json:"date"`
}

type inspectionResponse struct {
	ID           int             `json:"id"`
	CreatedAt    string          `json:"created_at"`
	UpdatedAt    string          `json:"updated_at"`
	CreatedBy    string          `json:"created_by"`
	UpdatedBy    string          `json:"updated_by"`
	Organization organizationDTO `json:"organization"`
	Head         headDTO         `json:"head"`
	Inspection   inspectionDTO   `json:"inspection"`
}

type inspectionListResponse struct {
	Items []inspectionResponse `json:"items"`
}

func main() {
	port, _ := strconv.Atoi(getEnv("DB_PORT", "5432"))
	db, err := sql.Open("postgres", buildDSN(connectionInfo{
		Host:     getEnv("DB_HOST", "postgres"),
		Port:     port,
		Username: getEnv("DB_USER", "postgres"),
		DBName:   getEnv("DB_NAME", "postgres"),
		Password: getEnv("DB_PASSWORD", "qwerty123"),
		SSLMode:  "disable",
	}))
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		log.Fatal(err)
	}

	srv := &server{
		db: db,
		sessions: &sessionStore{
			sessions: make(map[string]user),
		},
	}

	router := mux.NewRouter()
	router.Use(loggingMiddleware)

	api := router.PathPrefix("/api").Subrouter()
	api.HandleFunc("/health", srv.handleHealth).Methods(http.MethodGet)

	api.HandleFunc("/auth/login", srv.handleLogin).Methods(http.MethodPost)
	api.HandleFunc("/auth/logout", srv.withAuth(srv.handleLogout)).Methods(http.MethodPost)
	api.HandleFunc("/auth/me", srv.withAuth(srv.handleMe)).Methods(http.MethodGet)

	router.HandleFunc("/auth/login", srv.handleLogin).Methods(http.MethodPost)
	router.HandleFunc("/auth/logout", srv.withAuth(srv.handleLogout)).Methods(http.MethodPost)
	router.HandleFunc("/auth/me", srv.withAuth(srv.handleMe)).Methods(http.MethodGet)

	api.HandleFunc("/users", srv.withAuth(srv.requireAdmin(srv.handleUsersList))).Methods(http.MethodGet)
	api.HandleFunc("/users", srv.withAuth(srv.requireAdmin(srv.handleUserCreate))).Methods(http.MethodPost)
	api.HandleFunc("/users/{id:[0-9]+}", srv.withAuth(srv.requireAdmin(srv.handleUserDelete))).Methods(http.MethodDelete)
	api.HandleFunc("/users/{id:[0-9]+}/role", srv.withAuth(srv.requireAdmin(srv.handleUserRoleUpdate))).Methods(http.MethodPatch)

	api.HandleFunc("/inspections", srv.withAuth(srv.handleInspectionsList)).Methods(http.MethodGet)
	api.HandleFunc("/inspections", srv.withAuth(srv.handleInspectionCreate)).Methods(http.MethodPost)
	api.HandleFunc("/inspections/{id:[0-9]+}", srv.withAuth(srv.handleInspectionGet)).Methods(http.MethodGet)
	api.HandleFunc("/inspections/{id:[0-9]+}", srv.withAuth(srv.handleInspectionUpdate)).Methods(http.MethodPut)
	api.HandleFunc("/inspections/{id:[0-9]+}", srv.withAuth(srv.handleInspectionDelete)).Methods(http.MethodDelete)

	server := &http.Server{
		Addr:    ":8080",
		Handler: router,
	}

	log.Println("Server started at:", time.Now().Format(time.RFC3339))
	if err := server.ListenAndServe(); err != nil {
		log.Fatal(err)
	}
}

type connectionInfo struct {
	Host     string
	Port     int
	Username string
	DBName   string
	Password string
	SSLMode  string
}

func buildDSN(info connectionInfo) string {
	return "host=" + info.Host +
		" port=" + strconv.Itoa(info.Port) +
		" user=" + info.Username +
		" password=" + info.Password +
		" dbname=" + info.DBName +
		" sslmode=" + info.SSLMode
}

func getEnv(key, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value
}

func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("%s %s %s", r.Method, r.URL.Path, time.Since(start))
	})
}

func (s *server) handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *server) handleLogin(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		Login    string `json:"login"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "Некорректный формат запроса")
		return
	}
	userItem, err := s.getUserByLogin(r.Context(), payload.Login)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "Неверный логин или пароль")
		return
	}
	if userItem.Password != payload.Password {
		writeError(w, http.StatusUnauthorized, "Неверный логин или пароль")
		return
	}
	if userItem.Role == "no_access" {
		writeError(w, http.StatusForbidden, "Доступ запрещен")
		return
	}

	sessionID, err := newSessionID()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Не удалось создать сессию")
		return
	}

	s.sessions.set(sessionID, userItem)
	http.SetCookie(w, &http.Cookie{
		Name:     "session_id",
		Value:    sessionID,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   60 * 60 * 8,
	})

	response := map[string]any{
		"user": userItem.withoutPassword(),
	}
	writeJSON(w, http.StatusOK, response)
}

func (s *server) handleLogout(w http.ResponseWriter, r *http.Request, authUser user) {
	cookie, err := r.Cookie("session_id")
	if err == nil {
		s.sessions.delete(cookie.Value)
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "session_id",
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		MaxAge:   -1,
	})

	writeJSON(w, http.StatusNoContent, nil)
}

func (s *server) handleMe(w http.ResponseWriter, r *http.Request, authUser user) {
	writeJSON(w, http.StatusOK, authUser.withoutPassword())
}

func (s *server) handleUsersList(w http.ResponseWriter, r *http.Request, authUser user) {
	rows, err := s.db.QueryContext(r.Context(), `
		SELECT id, fio, login, password, role
		FROM users
		ORDER BY id
	`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Не удалось загрузить пользователей")
		return
	}
	defer rows.Close()

	var list []user
	for rows.Next() {
		var item user
		if err := rows.Scan(&item.ID, &item.Name, &item.Login, &item.Password, &item.Role); err != nil {
			writeError(w, http.StatusInternalServerError, "Не удалось обработать пользователей")
			return
		}
		list = append(list, item)
	}

	writeJSON(w, http.StatusOK, list)
}

func (s *server) handleUserCreate(w http.ResponseWriter, r *http.Request, authUser user) {
	var payload struct {
		Name     string `json:"name"`
		Login    string `json:"login"`
		Password string `json:"password"`
		Role     string `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "Некорректный формат запроса")
		return
	}
	payload.Name = strings.TrimSpace(payload.Name)
	payload.Login = strings.TrimSpace(payload.Login)
	payload.Password = strings.TrimSpace(payload.Password)
	payload.Role = normalizeRole(payload.Role)

	if payload.Name == "" || payload.Login == "" || payload.Password == "" {
		writeError(w, http.StatusBadRequest, "Заполните имя, логин и пароль")
		return
	}

	var id int
	err := s.db.QueryRowContext(r.Context(), `
		INSERT INTO users (fio, login, password, role)
		VALUES ($1, $2, $3, $4)
		RETURNING id
	`, payload.Name, payload.Login, payload.Password, payload.Role).Scan(&id)
	if err != nil {
		if strings.Contains(err.Error(), "users_login_key") {
			writeError(w, http.StatusConflict, "Логин уже занят")
			return
		}
		writeError(w, http.StatusInternalServerError, "Не удалось сохранить пользователя")
		return
	}

	created := user{ID: id, Name: payload.Name, Login: payload.Login, Password: payload.Password, Role: payload.Role}
	writeJSON(w, http.StatusCreated, created)
}

func (s *server) handleUserDelete(w http.ResponseWriter, r *http.Request, authUser user) {
	id, err := parseID(mux.Vars(r)["id"])
	if err != nil {
		writeError(w, http.StatusBadRequest, "Некорректный идентификатор")
		return
	}
	if id == authUser.ID {
		writeError(w, http.StatusConflict, "Нельзя удалить текущего пользователя")
		return
	}

	res, err := s.db.ExecContext(r.Context(), "DELETE FROM users WHERE id=$1", id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Не удалось удалить пользователя")
		return
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		writeError(w, http.StatusNotFound, "Пользователь не найден")
		return
	}
	writeJSON(w, http.StatusNoContent, nil)
}

func (s *server) handleUserRoleUpdate(w http.ResponseWriter, r *http.Request, authUser user) {
	id, err := parseID(mux.Vars(r)["id"])
	if err != nil {
		writeError(w, http.StatusBadRequest, "Некорректный идентификатор")
		return
	}
	var payload struct {
		Role string `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "Некорректный формат запроса")
		return
	}
	role := normalizeRole(payload.Role)

	res, err := s.db.ExecContext(r.Context(), "UPDATE users SET role=$1 WHERE id=$2", role, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Не удалось обновить роль")
		return
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		writeError(w, http.StatusNotFound, "Пользователь не найден")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"id": id, "role": role})
}

func (s *server) handleInspectionsList(w http.ResponseWriter, r *http.Request, authUser user) {
	items, err := s.fetchInspections(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Не удалось загрузить проверки")
		return
	}
	writeJSON(w, http.StatusOK, inspectionListResponse{Items: items})
}

func (s *server) handleInspectionGet(w http.ResponseWriter, r *http.Request, authUser user) {
	id, err := parseID(mux.Vars(r)["id"])
	if err != nil {
		writeError(w, http.StatusBadRequest, "Некорректный идентификатор")
		return
	}
	item, err := s.fetchInspectionByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "Проверка не найдена")
			return
		}
		writeError(w, http.StatusInternalServerError, "Не удалось загрузить проверку")
		return
	}
	writeJSON(w, http.StatusOK, item)
}

func (s *server) handleInspectionCreate(w http.ResponseWriter, r *http.Request, authUser user) {
	payload, err := decodeInspectionPayload(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	createdBy := authUser.Name

	item, err := s.insertInspection(r.Context(), payload, createdBy)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Не удалось сохранить проверку")
		return
	}
	writeJSON(w, http.StatusCreated, item)
}

func (s *server) handleInspectionUpdate(w http.ResponseWriter, r *http.Request, authUser user) {
	id, err := parseID(mux.Vars(r)["id"])
	if err != nil {
		writeError(w, http.StatusBadRequest, "Некорректный идентификатор")
		return
	}
	payload, err := decodeInspectionPayload(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	item, err := s.updateInspection(r.Context(), id, payload, authUser.Name)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "Проверка не найдена")
			return
		}
		writeError(w, http.StatusInternalServerError, "Не удалось обновить проверку")
		return
	}
	writeJSON(w, http.StatusOK, item)
}

func (s *server) handleInspectionDelete(w http.ResponseWriter, r *http.Request, authUser user) {
	id, err := parseID(mux.Vars(r)["id"])
	if err != nil {
		writeError(w, http.StatusBadRequest, "Некорректный идентификатор")
		return
	}
	res, err := s.db.ExecContext(r.Context(), "DELETE FROM act WHERE id=$1", id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Не удалось удалить проверку")
		return
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		writeError(w, http.StatusNotFound, "Проверка не найдена")
		return
	}
	writeJSON(w, http.StatusNoContent, nil)
}

func decodeInspectionPayload(r *http.Request) (actPayload, error) {
	var payload actPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		return payload, errors.New("Некорректный формат запроса")
	}
	return payload, nil
}

func (s *server) fetchInspections(ctx context.Context) ([]inspectionResponse, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT
			id,
			organization_full_name,
			organization_short_name,
			organization_ogrn,
			organization_legal_address,
			organization_postal_address,
			leader_position,
			leader_last_name,
			leader_first_name,
			leader_middle_name,
			inspection_type,
			minzdrav_order_number,
			minzdrav_order_date,
			inspection_number,
			date_start,
			date_end,
			duration_work_days,
			letter_number,
			letter_date,
			representative_document,
			addresses,
			authorized_persons,
			signatories,
			representatives,
			created_by,
			updated_by,
			created_at,
			updated_at
		FROM act
		ORDER BY created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []inspectionResponse
	for rows.Next() {
		item, err := scanInspectionRow(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, nil
}

func (s *server) fetchInspectionByID(ctx context.Context, id int) (inspectionResponse, error) {
	row := s.db.QueryRowContext(ctx, `
		SELECT
			id,
			organization_full_name,
			organization_short_name,
			organization_ogrn,
			organization_legal_address,
			organization_postal_address,
			leader_position,
			leader_last_name,
			leader_first_name,
			leader_middle_name,
			inspection_type,
			minzdrav_order_number,
			minzdrav_order_date,
			inspection_number,
			date_start,
			date_end,
			duration_work_days,
			letter_number,
			letter_date,
			representative_document,
			addresses,
			authorized_persons,
			signatories,
			representatives,
			created_by,
			updated_by,
			created_at,
			updated_at
		FROM act
		WHERE id=$1
	`, id)

	item, err := scanInspectionRow(row)
	if err != nil {
		return inspectionResponse{}, err
	}
	return item, nil
}

func (s *server) insertInspection(ctx context.Context, payload actPayload, createdBy string) (inspectionResponse, error) {
	letterNumber := buildLetterNumber(payload.Inspection.Letter)
	var daysValue *int
	if payload.Inspection.Period.Days != "" {
		if v, err := strconv.Atoi(payload.Inspection.Period.Days); err == nil {
			daysValue = &v
		}
	}

	var id int
	err := s.db.QueryRowContext(ctx, `
		INSERT INTO act (
			organization_full_name,
			organization_short_name,
			organization_ogrn,
			organization_legal_address,
			organization_postal_address,
			leader_position,
			leader_last_name,
			leader_first_name,
			leader_middle_name,
			inspection_type,
			minzdrav_order_number,
			minzdrav_order_date,
			inspection_number,
			date_start,
			date_end,
			duration_work_days,
			letter_number,
			letter_date,
			representative_document,
			addresses,
			authorized_persons,
			signatories,
			representatives,
			created_by,
			updated_by
		) VALUES (
			$1, $2, $3, $4, $5,
			$6, $7, $8, $9,
			$10, $11, $12,
			$13, $14, $15, $16,
			$17, $18, $19,
			$20, $21, $22, $23,
			$24, $25
		)
		RETURNING id
	`,
		payload.Organization.Name,
		payload.Organization.ShortName,
		payload.Organization.Ogrn,
		payload.Organization.Address.LegalAddress,
		payload.Organization.Address.PostalAddress,
		payload.Head.Role,
		payload.Head.LastName,
		payload.Head.NamePatronymic,
		payload.Head.LastNameTo,
		payload.Inspection.FormType,
		payload.Inspection.MzOrder.Number,
		parseDate(payload.Inspection.MzOrder.Date),
		payload.Inspection.Number,
		parseDate(payload.Inspection.Period.StartDate),
		parseDate(payload.Inspection.Period.EndDate),
		daysValue,
		letterNumber,
		parseDate(payload.Inspection.Letter.Date),
		payload.Inspection.Representative,
		pq.Array(buildAddresses(payload)),
		pq.Array(payload.Inspection.Inspectors),
		pq.Array(payload.Inspection.Signatures),
		pq.Array(buildRepresentatives(payload)),
		createdBy,
		createdBy,
	).Scan(&id)
	if err != nil {
		return inspectionResponse{}, err
	}
	return s.fetchInspectionByID(ctx, id)
}

func (s *server) updateInspection(ctx context.Context, id int, payload actPayload, updatedBy string) (inspectionResponse, error) {
	letterNumber := buildLetterNumber(payload.Inspection.Letter)
	var daysValue *int
	if payload.Inspection.Period.Days != "" {
		if v, err := strconv.Atoi(payload.Inspection.Period.Days); err == nil {
			daysValue = &v
		}
	}

	res, err := s.db.ExecContext(ctx, `
		UPDATE act
		SET
			organization_full_name=$1,
			organization_short_name=$2,
			organization_ogrn=$3,
			organization_legal_address=$4,
			organization_postal_address=$5,
			leader_position=$6,
			leader_last_name=$7,
			leader_first_name=$8,
			leader_middle_name=$9,
			inspection_type=$10,
			minzdrav_order_number=$11,
			minzdrav_order_date=$12,
			inspection_number=$13,
			date_start=$14,
			date_end=$15,
			duration_work_days=$16,
			letter_number=$17,
			letter_date=$18,
			representative_document=$19,
			addresses=$20,
			authorized_persons=$21,
			signatories=$22,
			representatives=$23,
			updated_by=$24
		WHERE id=$25
	`,
		payload.Organization.Name,
		payload.Organization.ShortName,
		payload.Organization.Ogrn,
		payload.Organization.Address.LegalAddress,
		payload.Organization.Address.PostalAddress,
		payload.Head.Role,
		payload.Head.LastName,
		payload.Head.NamePatronymic,
		payload.Head.LastNameTo,
		payload.Inspection.FormType,
		payload.Inspection.MzOrder.Number,
		parseDate(payload.Inspection.MzOrder.Date),
		payload.Inspection.Number,
		parseDate(payload.Inspection.Period.StartDate),
		parseDate(payload.Inspection.Period.EndDate),
		daysValue,
		letterNumber,
		parseDate(payload.Inspection.Letter.Date),
		payload.Inspection.Representative,
		pq.Array(buildAddresses(payload)),
		pq.Array(payload.Inspection.Inspectors),
		pq.Array(payload.Inspection.Signatures),
		pq.Array(buildRepresentatives(payload)),
		updatedBy,
		id,
	)
	if err != nil {
		return inspectionResponse{}, err
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return inspectionResponse{}, sql.ErrNoRows
	}
	return s.fetchInspectionByID(ctx, id)
}

func scanInspectionRow(scanner interface {
	Scan(dest ...any) error
}) (inspectionResponse, error) {
	var (
		item              inspectionResponse
		mzOrderDate       sql.NullTime
		startDate         sql.NullTime
		endDate           sql.NullTime
		letterDate        sql.NullTime
		representativeDoc sql.NullString
		addresses         []string
		inspectors        []string
		signatures        []string
		representatives   []string
		createdAt         time.Time
		updatedAt         time.Time
		duration          sql.NullInt64
	)

	if err := scanner.Scan(
		&item.ID,
		&item.Organization.Name,
		&item.Organization.ShortName,
		&item.Organization.Ogrn,
		&item.Organization.Address.LegalAddress,
		&item.Organization.Address.PostalAddress,
		&item.Head.Role,
		&item.Head.LastName,
		&item.Head.NamePatronymic,
		&item.Head.LastNameTo,
		&item.Inspection.FormType,
		&item.Inspection.MzOrder.Number,
		&mzOrderDate,
		&item.Inspection.Number,
		&startDate,
		&endDate,
		&duration,
		&item.Inspection.Letter.NumberLeft,
		&letterDate,
		&representativeDoc,
		pq.Array(&addresses),
		pq.Array(&inspectors),
		pq.Array(&signatures),
		pq.Array(&representatives),
		&item.CreatedBy,
		&item.UpdatedBy,
		&createdAt,
		&updatedAt,
	); err != nil {
		return inspectionResponse{}, err
	}

	item.Inspection.MzOrder.Date = formatDate(mzOrderDate)
	item.Inspection.Period.StartDate = formatDate(startDate)
	item.Inspection.Period.EndDate = formatDate(endDate)
	item.Inspection.Period.Days = formatDays(duration)
	item.Inspection.Letter.Date = formatDate(letterDate)
	item.Inspection.Letter.NumberLeft, item.Inspection.Letter.NumberRight = splitLetterNumber(item.Inspection.Letter.NumberLeft)
	item.Inspection.Representative = representativeDoc.String
	item.Inspection.AddressNoIndex = firstOrEmpty(addresses)
	item.Inspection.Inspectors = inspectors
	item.Inspection.Signatures = signatures
	if len(representatives) > 0 {
		item.Inspection.Representative = representatives[0]
	}

	item.CreatedAt = createdAt.Format(time.RFC3339)
	item.UpdatedAt = updatedAt.Format(time.RFC3339)

	return item, nil
}

func buildLetterNumber(letter letterDTO) string {
	left := strings.TrimSpace(letter.NumberLeft)
	right := strings.TrimSpace(letter.NumberRight)
	if left == "" && right == "" {
		return ""
	}
	if left != "" && right != "" {
		return left + "/" + right
	}
	return left + right
}

func splitLetterNumber(value string) (string, string) {
	parts := strings.SplitN(strings.TrimSpace(value), "/", 2)
	if len(parts) == 2 {
		return strings.TrimSpace(parts[0]), strings.TrimSpace(parts[1])
	}
	return strings.TrimSpace(value), ""
}

func buildAddresses(payload actPayload) []string {
	var addresses []string
	if payload.Inspection.AddressNoIndex != "" {
		addresses = append(addresses, payload.Inspection.AddressNoIndex)
	}
	return addresses
}

func buildRepresentatives(payload actPayload) []string {
	var reps []string
	if payload.Inspection.Representative != "" {
		reps = append(reps, payload.Inspection.Representative)
	}
	return reps
}

func parseDate(value string) *time.Time {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	parsed, err := time.Parse(dateLayout, value)
	if err != nil {
		return nil
	}
	return &parsed
}

func formatDate(value sql.NullTime) string {
	if !value.Valid {
		return ""
	}
	return value.Time.Format(dateLayout)
}

func formatDays(value sql.NullInt64) string {
	if !value.Valid {
		return ""
	}
	return strconv.FormatInt(value.Int64, 10)
}

func firstOrEmpty(values []string) string {
	if len(values) == 0 {
		return ""
	}
	return values[0]
}

func parseID(raw string) (int, error) {
	return strconv.Atoi(raw)
}

func normalizeRole(role string) string {
	switch strings.TrimSpace(role) {
	case "admin":
		return "admin"
	case "no_access":
		return "no_access"
	default:
		return "user"
	}
}

func newSessionID() (string, error) {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}

func (s *server) withAuth(next func(http.ResponseWriter, *http.Request, user)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, err := s.userFromRequest(r)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "Необходима авторизация")
			return
		}
		next(w, r, user)
	}
}

func (s *server) requireAdmin(next func(http.ResponseWriter, *http.Request, user)) func(http.ResponseWriter, *http.Request, user) {
	return func(w http.ResponseWriter, r *http.Request, authUser user) {
		if authUser.Role != "admin" {
			writeError(w, http.StatusForbidden, "Недостаточно прав")
			return
		}
		next(w, r, authUser)
	}
}

func (s *server) userFromRequest(r *http.Request) (user, error) {
	cookie, err := r.Cookie("session_id")
	if err != nil {
		return user{}, err
	}
	return s.sessions.get(cookie.Value)
}

func (s *server) getUserByLogin(ctx context.Context, login string) (user, error) {
	var item user
	err := s.db.QueryRowContext(ctx, `
		SELECT id, fio, login, password, role
		FROM users
		WHERE login=$1
	`, login).Scan(&item.ID, &item.Name, &item.Login, &item.Password, &item.Role)
	if err != nil {
		return user{}, err
	}
	return item, nil
}

func (s *sessionStore) set(id string, user user) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.sessions[id] = user
}

func (s *sessionStore) get(id string) (user, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	user, ok := s.sessions[id]
	if !ok {
		return user, errors.New("session not found")
	}
	return user, nil
}

func (s *sessionStore) delete(id string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.sessions, id)
}

func (u user) withoutPassword() user {
	return user{
		ID:    u.ID,
		Name:  u.Name,
		Login: u.Login,
		Role:  u.Role,
	}
}

func writeJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if data == nil {
		return
	}
	_ = json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"message": message})
}

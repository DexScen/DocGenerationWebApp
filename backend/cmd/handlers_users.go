package main

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/gorilla/mux"
)

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

	result, err := s.db.ExecContext(r.Context(), `
		INSERT INTO users (fio, login, password, role)
		VALUES (?, ?, ?, ?)
	`, payload.Name, payload.Login, payload.Password, payload.Role)
	if err != nil {
		if isDuplicateEntry(err) {
			writeError(w, http.StatusConflict, "Логин уже занят")
			return
		}
		writeError(w, http.StatusInternalServerError, "Не удалось сохранить пользователя")
		return
	}
	id, err := result.LastInsertId()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Не удалось сохранить пользователя")
		return
	}

	created := user{ID: int(id), Name: payload.Name, Login: payload.Login, Password: payload.Password, Role: payload.Role}
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

	res, err := s.db.ExecContext(r.Context(), "DELETE FROM users WHERE id=?", id)
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

	res, err := s.db.ExecContext(r.Context(), "UPDATE users SET role=? WHERE id=?", role, id)
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

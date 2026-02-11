package main

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/gorilla/mux"
)

func (s *server) handleEmployeesList(w http.ResponseWriter, r *http.Request, authUser user) {
	rows, err := s.db.QueryContext(r.Context(), `
		SELECT id, fio
		FROM employees
		ORDER BY id
	`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Не удалось загрузить сотрудников")
		return
	}
	defer rows.Close()

	var list []employee
	for rows.Next() {
		var item employee
		if err := rows.Scan(&item.ID, &item.Name); err != nil {
			writeError(w, http.StatusInternalServerError, "Не удалось обработать сотрудников")
			return
		}
		list = append(list, item)
	}

	writeJSON(w, http.StatusOK, list)
}

func (s *server) handleEmployeeCreate(w http.ResponseWriter, r *http.Request, authUser user) {
	var payload struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "Некорректный формат запроса")
		return
	}
	payload.Name = strings.TrimSpace(payload.Name)
	if payload.Name == "" {
		writeError(w, http.StatusBadRequest, "Заполните ФИО")
		return
	}

	result, err := s.db.ExecContext(r.Context(), `
		INSERT INTO employees (fio)
		VALUES (?)
	`, payload.Name)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Не удалось сохранить сотрудника")
		return
	}
	id, err := result.LastInsertId()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Не удалось сохранить сотрудника")
		return
	}

	created := employee{ID: int(id), Name: payload.Name}
	writeJSON(w, http.StatusCreated, created)
}

func (s *server) handleEmployeeDelete(w http.ResponseWriter, r *http.Request, authUser user) {
	id, err := parseID(mux.Vars(r)["id"])
	if err != nil {
		writeError(w, http.StatusBadRequest, "Некорректный идентификатор")
		return
	}

	res, err := s.db.ExecContext(r.Context(), "DELETE FROM employees WHERE id=?", id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Не удалось удалить сотрудника")
		return
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		writeError(w, http.StatusNotFound, "Сотрудник не найден")
		return
	}
	writeJSON(w, http.StatusNoContent, nil)
}

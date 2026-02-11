package main

import (
	"database/sql"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/gorilla/mux"
)

func (s *server) handleInspectionsList(w http.ResponseWriter, r *http.Request, authUser user) {
	query := parseInspectionListQuery(r)
	items, total, err := s.fetchInspections(r.Context(), query)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Не удалось загрузить проверки")
		return
	}
	writeJSON(w, http.StatusOK, inspectionListResponse{
		Items:    items,
		Total:    total,
		Page:     query.Page,
		PageSize: query.PageSize,
	})
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
	res, err := s.db.ExecContext(r.Context(), "DELETE FROM act WHERE id=?", id)
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

type inspectionListQuery struct {
	Page     int
	PageSize int
	Year     int
	Ogrn     string
}

func parseInspectionListQuery(r *http.Request) inspectionListQuery {
	const (
		defaultPageSize = 10
		maxPageSize     = 500
	)
	values := r.URL.Query()
	page := parsePositiveInt(values.Get("page"), 1)
	pageSize := parsePositiveInt(values.Get("page_size"), defaultPageSize)
	if pageSize > maxPageSize {
		pageSize = maxPageSize
	}
	year := parsePositiveInt(values.Get("year"), 0)
	ogrn := strings.TrimSpace(values.Get("ogrn"))
	return inspectionListQuery{
		Page:     page,
		PageSize: pageSize,
		Year:     year,
		Ogrn:     ogrn,
	}
}

func parsePositiveInt(value string, fallback int) int {
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil || parsed <= 0 {
		return fallback
	}
	return parsed
}

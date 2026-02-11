package main

import (
	"encoding/json"
	"net/http"
)

func (s *server) handleVerificationAreasGet(w http.ResponseWriter, r *http.Request, authUser user) {
	areas, err := s.fetchVerificationAreas(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Не удалось загрузить области проверки")
		return
	}

	writeJSON(w, http.StatusOK, verificationAreasResponse{Items: areas})
}

func (s *server) handleVerificationAreasUpsert(w http.ResponseWriter, r *http.Request, authUser user) {
	defer r.Body.Close()

	var payload verificationAreasUpsertRequest
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "Некорректный JSON")
		return
	}

	areas := normalizeVerificationAreas(payload.Items)
	if err := s.replaceVerificationAreas(r.Context(), areas); err != nil {
		writeError(w, http.StatusInternalServerError, "Не удалось сохранить области проверки")
		return
	}

	writeJSON(w, http.StatusOK, verificationAreasResponse{Items: areas})
}

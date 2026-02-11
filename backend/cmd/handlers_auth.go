package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net/http"
)

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

func newSessionID() (string, error) {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}

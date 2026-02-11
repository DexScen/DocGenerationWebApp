package main

import (
	"database/sql"
	"errors"
	"net/http"
	"sync"
)

type server struct {
	db       *sql.DB
	sessions *sessionStore
}

func newServer(db *sql.DB) *server {
	return &server{
		db:       db,
		sessions: newSessionStore(),
	}
}

type sessionStore struct {
	mu       sync.RWMutex
	sessions map[string]user
}

func newSessionStore() *sessionStore {
	return &sessionStore{sessions: make(map[string]user)}
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

func (s *server) withAuth(next func(http.ResponseWriter, *http.Request, user)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		authUser, err := s.userFromRequest(r)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "Необходима авторизация")
			return
		}
		next(w, r, authUser)
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

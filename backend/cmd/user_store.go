package main

import "context"

func (s *server) getUserByLogin(ctx context.Context, login string) (user, error) {
	var item user
	err := s.db.QueryRowContext(ctx, `
		SELECT id, fio, login, password, role
		FROM users
		WHERE login=?
	`, login).Scan(&item.ID, &item.Name, &item.Login, &item.Password, &item.Role)
	if err != nil {
		return user{}, err
	}
	return item, nil
}

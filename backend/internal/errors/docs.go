package errors

import "errors"

var (
	ErrLeaderNotFound = errors.New("leader not found")
	ErrOrganizationNotFound = errors.New("organization not found")
)
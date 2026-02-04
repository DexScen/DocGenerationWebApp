package domain

import "time"

type Organization struct {
	ID            int64     `json:"id"`
	FullName      string    `json:"full_name"`
	ShortName     string    `json:"short_name,omitempty"`
	OGRN          string    `json:"ogrn"`
	LegalAddress  string    `json:"legal_address"`
	PostalAddress string    `json:"postal_address,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type Leader struct {
	ID             int64 `json:"id"`
	OrganizationID int64 `json:"organization_id"`

	Position   string `json:"position"`
	LastName   string `json:"last_name"`
	FirstName  string `json:"first_name"`
	MiddleName string `json:"middle_name,omitempty"`

	InitialsNameIm  string `json:"initials_name_im,omitempty"`
	InitialsNameDat string `json:"initials_name_dat,omitempty"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

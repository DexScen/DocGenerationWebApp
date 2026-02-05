package domain

import "time"

const (
	InspectionPlannedDocumentary   = "плановая документарная"
	InspectionPlannedOnsite        = "плановая выездная"
	InspectionUnplannedDocumentary = "внеплановая документарная"
	InspectionUnplannedOnsite      = "внеплановая выездная"
)

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

type Inspection struct {
	ID             int64 `json:"id"`
	OrganizationID int64 `json:"organization_id"`

	InspectionType string `json:"inspection_type"`

	MinzdravOrderNumber string  `json:"minzdrav_order_number,omitempty"`
	MinzdravOrderDate   *string `json:"minzdrav_order_date,omitempty"`
	MinzdravOrderName   string  `json:"minzdrav_order_name,omitempty"`

	ChomiazOrderNumber string  `json:"chomiaz_order_number,omitempty"`
	ChomiazOrderDate   *string `json:"chomiaz_order_date,omitempty"`

	LetterNumber string  `json:"letter_number,omitempty"`
	LetterDate   *string `json:"letter_date,omitempty"`

	InspectionNumber string  `json:"inspection_number,omitempty"`
	DateStart        *string `json:"date_start,omitempty"`
	DateEnd          *string `json:"date_end,omitempty"`
	DateEarlyEnd     *string `json:"date_early_end,omitempty"`
	DurationWorkDays int     `json:"duration_work_days,omitempty"`

	RepresentativeDocument string `json:"representative_document,omitempty"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	Addresses         []InspectionAddress          `json:"addresses,omitempty"`
	AuthorizedPersons []InspectionAuthorizedPerson `json:"authorized_persons,omitempty"`
	Signatories       []InspectionSignatory        `json:"signatories,omitempty"`
	Representatives   []InspectionRepresentative   `json:"representatives,omitempty"`
}

type InspectionAddress struct {
	ID           int64  `json:"id"`
	InspectionID int64  `json:"inspection_id"`
	Address      string `json:"address"`
}

type InspectionAuthorizedPerson struct {
	ID           int64  `json:"id"`
	InspectionID int64  `json:"inspection_id"`
	FullName     string `json:"full_name"`
}

type InspectionSignatory struct {
	ID           int64  `json:"id"`
	InspectionID int64  `json:"inspection_id"`
	FullName     string `json:"full_name"`
}

type InspectionRepresentative struct {
	ID           int64  `json:"id"`
	InspectionID int64  `json:"inspection_id"`
	FullName     string `json:"full_name"`
}

type InspectionHistoryItem struct {
	ID               int64   `json:"id"`
	InspectionType   string  `json:"inspection_type"`
	InspectionNumber string  `json:"inspection_number,omitempty"`
	DateStart        *string `json:"date_start,omitempty"`
	DateEnd          *string `json:"date_end,omitempty"`
	CreatedAt        string  `json:"created_at"`

	OrganizationID   int64  `json:"organization_id"`
	OrganizationName string `json:"organization_name"`
}

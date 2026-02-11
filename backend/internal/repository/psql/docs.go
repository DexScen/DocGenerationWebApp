package psql

import (
	"context"
	"database/sql"

	"github.com/DexScen/DocGenerationWebApp/backend/internal/domain"
	e "github.com/DexScen/DocGenerationWebApp/backend/internal/errors"
	_ "github.com/go-sql-driver/mysql"
)

type Docs struct {
	db *sql.DB
}

func NewDocs(db *sql.DB) *Docs {
	return &Docs{db: db}
}

func (d *Docs) GetAllOrganizations(ctx context.Context) ([]domain.Organization, error) {
	query := `
		SELECT
			id,
			full_name,
			short_name,
			ogrn,
			legal_address,
			postal_address,
			created_at,
			updated_at
		FROM organizations
	`

	rows, err := d.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	orgs := make([]domain.Organization, 0)

	for rows.Next() {
		var org domain.Organization
		if err := rows.Scan(
			&org.ID,
			&org.FullName,
			&org.ShortName,
			&org.OGRN,
			&org.LegalAddress,
			&org.PostalAddress,
			&org.CreatedAt,
			&org.UpdatedAt,
		); err != nil {
			return nil, err
		}
		orgs = append(orgs, org)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return orgs, nil
}

func (d *Docs) PostNewOrganization(ctx context.Context, org domain.Organization) error {
	query := `
		INSERT INTO organizations
			(full_name, short_name, ogrn, legal_address, postal_address, created_at, updated_at)
		VALUES
			(?, ?, ?, ?, ?, now(), now())
	`

	_, err := d.db.ExecContext(ctx, query,
		org.FullName,
		org.ShortName,
		org.OGRN,
		org.LegalAddress,
		org.PostalAddress,
	)
	return err
}

func (d *Docs) GetLeadersByOrgID(ctx context.Context, orgID int) ([]domain.Leader, error) {
	query := `
        SELECT
            id,
            organization_id,
            position,
            last_name,
            first_name,
            middle_name,
            initials_name_im,
            initials_name_dat,
            created_at,
            updated_at
        FROM leader
        WHERE organization_id = ?
    `

	rows, err := d.db.QueryContext(ctx, query, orgID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var leaders []domain.Leader

	for rows.Next() {
		var l domain.Leader
		err := rows.Scan(
			&l.ID,
			&l.OrganizationID,
			&l.Position,
			&l.LastName,
			&l.FirstName,
			&l.MiddleName,
			&l.InitialsNameIm,
			&l.InitialsNameDat,
			&l.CreatedAt,
			&l.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		leaders = append(leaders, l)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return leaders, nil
}

func (d *Docs) PostLeaderByOrgID(ctx context.Context, leader domain.Leader, org_id int) error {
	query := `
        INSERT INTO leader (
            organization_id,
            position,
            last_name,
            first_name,
            middle_name,
            initials_name_im,
            initials_name_dat,
            created_at,
            updated_at
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, NOW(), NOW()
        )
    `

	_, err := d.db.ExecContext(ctx, query,
		org_id,
		leader.Position,
		leader.LastName,
		leader.FirstName,
		leader.MiddleName,
		leader.InitialsNameIm,
		leader.InitialsNameDat,
	)
	return err
}

func (d *Docs) DeleteOrganizationByID(ctx context.Context, org_id int) error {
	query := `
        DELETE FROM organizations
        WHERE id = ?
    `

	res, err := d.db.ExecContext(ctx, query, org_id)
	if err != nil {
		return err
	}

	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return err
	}

	if rowsAffected == 0 {
		return e.ErrOrganizationNotFound
	}

	return nil
}

func (d *Docs) DeleteLeaderByID(ctx context.Context, id int) error {
	query := `
        DELETE FROM leader
        WHERE id = ?
    `

	res, err := d.db.ExecContext(ctx, query, id)
	if err != nil {
		return err
	}

	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return err
	}

	if rowsAffected == 0 {
		return e.ErrLeaderNotFound
	}

	return nil
}

func (d *Docs) PutOrganizationByID(ctx context.Context, org domain.Organization, org_id int) error {
	query := `
        UPDATE organizations
        SET
            full_name = ?,
            short_name = ?,
            ogrn = ?,
            legal_address = ?,
            postal_address = ?,
            updated_at = NOW()
        WHERE id = ?
    `

	res, err := d.db.ExecContext(ctx, query,
		org.FullName,
		org.ShortName,
		org.OGRN,
		org.LegalAddress,
		org.PostalAddress,
		org_id,
	)
	if err != nil {
		return err
	}

	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return err
	}

	if rowsAffected == 0 {
		return e.ErrOrganizationNotFound
	}

	return nil
}

func (d *Docs) GetAllInspectionsForHistory(
	ctx context.Context,
) ([]domain.InspectionHistoryItem, error) {

	query := `
        SELECT
            i.id,
            i.inspection_type,
            i.inspection_number,
            i.date_start,
            i.date_end,
            i.created_at,
            o.id,
            o.full_name
        FROM inspection i
        JOIN organizations o ON o.id = i.organization_id
        ORDER BY (i.date_start IS NULL) ASC, i.date_start DESC, i.created_at DESC
    `

	rows, err := d.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []domain.InspectionHistoryItem

	for rows.Next() {
		var item domain.InspectionHistoryItem
		err := rows.Scan(
			&item.ID,
			&item.InspectionType,
			&item.InspectionNumber,
			&item.DateStart,
			&item.DateEnd,
			&item.CreatedAt,
			&item.OrganizationID,
			&item.OrganizationName,
		)
		if err != nil {
			return nil, err
		}
		result = append(result, item)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return result, nil
}

func (d *Docs) GetInspectionByID(
	ctx context.Context,
	id int,
) (domain.Inspection, error) {

	var insp domain.Inspection

	// --- основная проверка ---
	query := `
        SELECT
            id,
            organization_id,
            inspection_type,
            minzdrav_order_number,
            minzdrav_order_date,
            minzdrav_order_name,
            chomiaz_order_number,
            chomiaz_order_date,
            letter_number,
            letter_date,
            inspection_number,
            date_start,
            date_end,
            date_early_end,
            duration_work_days,
            representative_document
        FROM inspection
        WHERE id = ?
    `

	err := d.db.QueryRowContext(ctx, query, id).Scan(
		&insp.ID,
		&insp.OrganizationID,
		&insp.InspectionType,
		&insp.MinzdravOrderNumber,
		&insp.MinzdravOrderDate,
		&insp.MinzdravOrderName,
		&insp.ChomiazOrderNumber,
		&insp.ChomiazOrderDate,
		&insp.LetterNumber,
		&insp.LetterDate,
		&insp.InspectionNumber,
		&insp.DateStart,
		&insp.DateEnd,
		&insp.DateEarlyEnd,
		&insp.DurationWorkDays,
		&insp.RepresentativeDocument,
	)
	if err != nil {
		return domain.Inspection{}, err
	}

	// --- addresses ---
	rows, err := d.db.QueryContext(
		ctx,
		`SELECT id, inspection_id, address FROM inspection_addresses WHERE inspection_id = ?`,
		id,
	)
	if err != nil {
		return domain.Inspection{}, err
	}
	for rows.Next() {
		var a domain.InspectionAddress
		if err := rows.Scan(&a.ID, &a.InspectionID, &a.Address); err != nil {
			rows.Close()
			return domain.Inspection{}, err
		}
		insp.Addresses = append(insp.Addresses, a)
	}
	rows.Close()

	// --- authorized persons ---
	rows, err = d.db.QueryContext(
		ctx,
		`SELECT id, inspection_id, full_name FROM inspection_authorized_persons WHERE inspection_id = ?`,
		id,
	)
	if err != nil {
		return domain.Inspection{}, err
	}
	for rows.Next() {
		var p domain.InspectionAuthorizedPerson
		if err := rows.Scan(&p.ID, &p.InspectionID, &p.FullName); err != nil {
			rows.Close()
			return domain.Inspection{}, err
		}
		insp.AuthorizedPersons = append(insp.AuthorizedPersons, p)
	}
	rows.Close()

	// --- signatories ---
	rows, err = d.db.QueryContext(
		ctx,
		`SELECT id, inspection_id, full_name FROM inspection_signatories WHERE inspection_id = ?`,
		id,
	)
	if err != nil {
		return domain.Inspection{}, err
	}
	for rows.Next() {
		var s domain.InspectionSignatory
		if err := rows.Scan(&s.ID, &s.InspectionID, &s.FullName); err != nil {
			rows.Close()
			return domain.Inspection{}, err
		}
		insp.Signatories = append(insp.Signatories, s)
	}
	rows.Close()

	// --- representatives ---
	rows, err = d.db.QueryContext(
		ctx,
		`SELECT id, inspection_id, full_name FROM inspection_representatives WHERE inspection_id = ?`,
		id,
	)
	if err != nil {
		return domain.Inspection{}, err
	}
	for rows.Next() {
		var r domain.InspectionRepresentative
		if err := rows.Scan(&r.ID, &r.InspectionID, &r.FullName); err != nil {
			rows.Close()
			return domain.Inspection{}, err
		}
		insp.Representatives = append(insp.Representatives, r)
	}
	rows.Close()

	return insp, nil
}

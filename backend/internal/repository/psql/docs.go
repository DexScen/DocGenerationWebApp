package psql

import (
	"context"
	"database/sql"

	"github.com/DexScen/DocGenerationWebApp/backend/internal/domain"
	e "github.com/DexScen/DocGenerationWebApp/backend/internal/errors"
	_ "github.com/lib/pq"
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
			($1, $2, $3, $4, $5, now(), now())
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
        WHERE organization_id = $1
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
            $1, $2, $3, $4, $5, $6, $7, NOW(), NOW()
        )
    `

    var id int64
    err := d.db.QueryRowContext(ctx, query,
        org_id,
        leader.Position,
        leader.LastName,
        leader.FirstName,
        leader.MiddleName,
        leader.InitialsNameIm,
        leader.InitialsNameDat,
    ).Scan(&id)

    if err != nil {
        return err
    }

    return nil
}

func (d *Docs) DeleteOrganizationByID(ctx context.Context, org_id int) error {
    query := `
        DELETE FROM organization
        WHERE id = $1
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

func (d *Docs) DeleteLeaderByID(ctx context.Context, id int) error{
	query := `
        DELETE FROM leader
        WHERE id = $1
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
        UPDATE organization
        SET
            full_name = $1,
            short_name = $2,
            ogrn = $3,
            legal_address = $4,
            postal_address = $5,
            updated_at = NOW()
        WHERE id = $6
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
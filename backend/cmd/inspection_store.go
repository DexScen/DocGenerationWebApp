package main

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"
)

func (s *server) fetchInspections(ctx context.Context, query inspectionListQuery) ([]inspectionResponse, int, error) {
	where, args := buildInspectionFilters(query)

	countQuery := fmt.Sprintf(`
		SELECT COUNT(*)
		FROM act
		INNER JOIN act_organization org ON org.act_id = act.id
		INNER JOIN act_head head ON head.act_id = act.id
		INNER JOIN act_inspection insp ON insp.act_id = act.id
		WHERE %s
	`, where)
	var total int
	if err := s.db.QueryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	offset := (query.Page - 1) * query.PageSize
	args = append(args, query.PageSize, offset)
	rows, err := s.db.QueryContext(ctx, fmt.Sprintf(`
		SELECT
			act.id,
			org.organization_full_name,
			COALESCE(org.organization_short_name, ''),
			org.organization_ogrn,
			org.organization_legal_address,
			COALESCE(org.organization_postal_address, ''),
			head.leader_position,
			head.leader_last_name,
			head.leader_first_name,
			COALESCE(head.leader_middle_name, ''),
			insp.inspection_type,
			insp.minzdrav_order_number,
			insp.minzdrav_order_date,
			insp.inspection_number,
			insp.date_start,
			insp.date_end,
			insp.duration_work_days,
			insp.letter_number,
			insp.letter_date,
			insp.representative_document,
			insp.addresses,
			insp.authorized_persons,
			insp.signatories,
			insp.representatives,
			act.created_by,
			act.updated_by,
			act.created_at,
			act.updated_at
		FROM act
		INNER JOIN act_organization org ON org.act_id = act.id
		INNER JOIN act_head head ON head.act_id = act.id
		INNER JOIN act_inspection insp ON insp.act_id = act.id
		WHERE %s
		ORDER BY act.created_at DESC
		LIMIT ? OFFSET ?
	`, where), args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var items []inspectionResponse
	for rows.Next() {
		item, err := scanInspectionRow(rows)
		if err != nil {
			return nil, 0, err
		}
		items = append(items, item)
	}
	return items, total, nil
}

func (s *server) fetchInspectionByID(ctx context.Context, id int) (inspectionResponse, error) {
	row := s.db.QueryRowContext(ctx, `
		SELECT
			act.id,
			org.organization_full_name,
			COALESCE(org.organization_short_name, ''),
			org.organization_ogrn,
			org.organization_legal_address,
			COALESCE(org.organization_postal_address, ''),
			head.leader_position,
			head.leader_last_name,
			head.leader_first_name,
			COALESCE(head.leader_middle_name, ''),
			insp.inspection_type,
			insp.minzdrav_order_number,
			insp.minzdrav_order_date,
			insp.inspection_number,
			insp.date_start,
			insp.date_end,
			insp.duration_work_days,
			insp.letter_number,
			insp.letter_date,
			insp.representative_document,
			insp.addresses,
			insp.authorized_persons,
			insp.signatories,
			insp.representatives,
			act.created_by,
			act.updated_by,
			act.created_at,
			act.updated_at
		FROM act
		INNER JOIN act_organization org ON org.act_id = act.id
		INNER JOIN act_head head ON head.act_id = act.id
		INNER JOIN act_inspection insp ON insp.act_id = act.id
		WHERE act.id=?
	`, id)

	item, err := scanInspectionRow(row)
	if err != nil {
		return inspectionResponse{}, err
	}
	return item, nil
}

func buildInspectionFilters(query inspectionListQuery) (string, []interface{}) {
	clauses := []string{"1=1"}
	var args []interface{}

	if query.Ogrn != "" {
		clauses = append(clauses, "org.organization_ogrn LIKE ?")
		args = append(args, "%"+query.Ogrn+"%")
	}

	if query.Year > 0 {
		clauses = append(clauses, "(YEAR(insp.date_start)=? OR YEAR(insp.date_end)=? OR YEAR(act.created_at)=?)")
		args = append(args, query.Year, query.Year, query.Year)
	}

	return strings.Join(clauses, " AND "), args
}

func (s *server) insertInspection(ctx context.Context, payload actPayload, createdBy string) (inspectionResponse, error) {
	letterNumber := buildLetterNumber(payload.Inspection.Letter)
	var daysValue *int
	if payload.Inspection.Period.Days != "" {
		if v, err := strconv.Atoi(payload.Inspection.Period.Days); err == nil {
			daysValue = &v
		}
	}

	addressesJSON, err := marshalStringSlice(buildAddresses(payload))
	if err != nil {
		return inspectionResponse{}, err
	}
	inspectorsJSON, err := marshalStringSlice(payload.Inspection.Inspectors)
	if err != nil {
		return inspectionResponse{}, err
	}
	signaturesJSON, err := marshalStringSlice(payload.Inspection.Signatures)
	if err != nil {
		return inspectionResponse{}, err
	}
	representatives := buildRepresentatives(payload)
	representativesJSON, err := marshalStringSlice(representatives)
	if err != nil {
		return inspectionResponse{}, err
	}
	representativeDoc := firstOrEmpty(representatives)

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return inspectionResponse{}, err
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	result, err := tx.ExecContext(ctx, `
		INSERT INTO act (created_by, updated_by)
		VALUES (?, ?)
	`, createdBy, createdBy)
	if err != nil {
		return inspectionResponse{}, err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return inspectionResponse{}, err
	}

	_, err = tx.ExecContext(ctx, `
		INSERT INTO act_organization (
			act_id,
			organization_full_name,
			organization_short_name,
			organization_ogrn,
			organization_legal_address,
			organization_postal_address
		) VALUES (?, ?, ?, ?, ?, ?)
	`,
		id,
		payload.Organization.Name,
		payload.Organization.ShortName,
		payload.Organization.Ogrn,
		payload.Organization.Address.LegalAddress,
		payload.Organization.Address.PostalAddress,
	)
	if err != nil {
		return inspectionResponse{}, err
	}

	_, err = tx.ExecContext(ctx, `
		INSERT INTO act_head (
			act_id,
			leader_position,
			leader_last_name,
			leader_first_name,
			leader_middle_name
		) VALUES (?, ?, ?, ?, ?)
	`,
		id,
		payload.Head.Role,
		payload.Head.LastName,
		payload.Head.NamePatronymic,
		payload.Head.LastNameTo,
	)
	if err != nil {
		return inspectionResponse{}, err
	}

	_, err = tx.ExecContext(ctx, `
		INSERT INTO act_inspection (
			act_id,
			inspection_type,
			minzdrav_order_number,
			minzdrav_order_date,
			inspection_number,
			date_start,
			date_end,
			duration_work_days,
			letter_number,
			letter_date,
			representative_document,
			addresses,
			authorized_persons,
			signatories,
			representatives
		) VALUES (
			?, ?, ?, ?, ?,
			?, ?, ?,
			?, ?, ?,
			?, ?, ?, ?
		)
	`,
		id,
		payload.Inspection.FormType,
		payload.Inspection.MzOrder.Number,
		parseDate(payload.Inspection.MzOrder.Date),
		payload.Inspection.Number,
		parseDate(payload.Inspection.Period.StartDate),
		parseDate(payload.Inspection.Period.EndDate),
		daysValue,
		letterNumber,
		parseDate(payload.Inspection.Letter.Date),
		representativeDoc,
		addressesJSON,
		inspectorsJSON,
		signaturesJSON,
		representativesJSON,
	)
	if err != nil {
		return inspectionResponse{}, err
	}

	if err := tx.Commit(); err != nil {
		return inspectionResponse{}, err
	}
	return s.fetchInspectionByID(ctx, int(id))
}

func (s *server) updateInspection(ctx context.Context, id int, payload actPayload, updatedBy string) (inspectionResponse, error) {
	letterNumber := buildLetterNumber(payload.Inspection.Letter)
	var daysValue *int
	if payload.Inspection.Period.Days != "" {
		if v, err := strconv.Atoi(payload.Inspection.Period.Days); err == nil {
			daysValue = &v
		}
	}

	addressesJSON, err := marshalStringSlice(buildAddresses(payload))
	if err != nil {
		return inspectionResponse{}, err
	}
	inspectorsJSON, err := marshalStringSlice(payload.Inspection.Inspectors)
	if err != nil {
		return inspectionResponse{}, err
	}
	signaturesJSON, err := marshalStringSlice(payload.Inspection.Signatures)
	if err != nil {
		return inspectionResponse{}, err
	}
	representatives := buildRepresentatives(payload)
	representativesJSON, err := marshalStringSlice(representatives)
	if err != nil {
		return inspectionResponse{}, err
	}
	representativeDoc := firstOrEmpty(representatives)

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return inspectionResponse{}, err
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	res, err := tx.ExecContext(ctx, `
		UPDATE act
		SET updated_by=?
		WHERE id=?
	`, updatedBy, id)
	if err != nil {
		return inspectionResponse{}, err
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		var exists int
		err = tx.QueryRowContext(ctx, "SELECT 1 FROM act WHERE id=?", id).Scan(&exists)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return inspectionResponse{}, sql.ErrNoRows
			}
			return inspectionResponse{}, err
		}
	}

	_, err = tx.ExecContext(ctx, `
		INSERT INTO act_organization (
			act_id,
			organization_full_name,
			organization_short_name,
			organization_ogrn,
			organization_legal_address,
			organization_postal_address
		) VALUES (?, ?, ?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE
			organization_full_name=VALUES(organization_full_name),
			organization_short_name=VALUES(organization_short_name),
			organization_ogrn=VALUES(organization_ogrn),
			organization_legal_address=VALUES(organization_legal_address),
			organization_postal_address=VALUES(organization_postal_address)
	`,
		id,
		payload.Organization.Name,
		payload.Organization.ShortName,
		payload.Organization.Ogrn,
		payload.Organization.Address.LegalAddress,
		payload.Organization.Address.PostalAddress,
	)
	if err != nil {
		return inspectionResponse{}, err
	}

	_, err = tx.ExecContext(ctx, `
		INSERT INTO act_head (
			act_id,
			leader_position,
			leader_last_name,
			leader_first_name,
			leader_middle_name
		) VALUES (?, ?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE
			leader_position=VALUES(leader_position),
			leader_last_name=VALUES(leader_last_name),
			leader_first_name=VALUES(leader_first_name),
			leader_middle_name=VALUES(leader_middle_name)
	`,
		id,
		payload.Head.Role,
		payload.Head.LastName,
		payload.Head.NamePatronymic,
		payload.Head.LastNameTo,
	)
	if err != nil {
		return inspectionResponse{}, err
	}

	_, err = tx.ExecContext(ctx, `
		INSERT INTO act_inspection (
			act_id,
			inspection_type,
			minzdrav_order_number,
			minzdrav_order_date,
			inspection_number,
			date_start,
			date_end,
			duration_work_days,
			letter_number,
			letter_date,
			representative_document,
			addresses,
			authorized_persons,
			signatories,
			representatives
		) VALUES (
			?, ?, ?, ?, ?,
			?, ?, ?,
			?, ?, ?,
			?, ?, ?, ?
		)
		ON DUPLICATE KEY UPDATE
			inspection_type=VALUES(inspection_type),
			minzdrav_order_number=VALUES(minzdrav_order_number),
			minzdrav_order_date=VALUES(minzdrav_order_date),
			inspection_number=VALUES(inspection_number),
			date_start=VALUES(date_start),
			date_end=VALUES(date_end),
			duration_work_days=VALUES(duration_work_days),
			letter_number=VALUES(letter_number),
			letter_date=VALUES(letter_date),
			representative_document=VALUES(representative_document),
			addresses=VALUES(addresses),
			authorized_persons=VALUES(authorized_persons),
			signatories=VALUES(signatories),
			representatives=VALUES(representatives)
	`,
		id,
		payload.Inspection.FormType,
		payload.Inspection.MzOrder.Number,
		parseDate(payload.Inspection.MzOrder.Date),
		payload.Inspection.Number,
		parseDate(payload.Inspection.Period.StartDate),
		parseDate(payload.Inspection.Period.EndDate),
		daysValue,
		letterNumber,
		parseDate(payload.Inspection.Letter.Date),
		representativeDoc,
		addressesJSON,
		inspectorsJSON,
		signaturesJSON,
		representativesJSON,
	)
	if err != nil {
		return inspectionResponse{}, err
	}

	if err := tx.Commit(); err != nil {
		return inspectionResponse{}, err
	}
	return s.fetchInspectionByID(ctx, id)
}

func scanInspectionRow(scanner interface {
	Scan(dest ...any) error
}) (inspectionResponse, error) {
	var (
		item                inspectionResponse
		mzOrderDate         sql.NullTime
		startDate           sql.NullTime
		endDate             sql.NullTime
		letterDate          sql.NullTime
		representativeDoc   sql.NullString
		addressesJSON       []byte
		inspectorsJSON      []byte
		signaturesJSON      []byte
		representativesJSON []byte
		createdAt           time.Time
		updatedAt           time.Time
		duration            sql.NullInt64
	)

	if err := scanner.Scan(
		&item.ID,
		&item.Organization.Name,
		&item.Organization.ShortName,
		&item.Organization.Ogrn,
		&item.Organization.Address.LegalAddress,
		&item.Organization.Address.PostalAddress,
		&item.Head.Role,
		&item.Head.LastName,
		&item.Head.NamePatronymic,
		&item.Head.LastNameTo,
		&item.Inspection.FormType,
		&item.Inspection.MzOrder.Number,
		&mzOrderDate,
		&item.Inspection.Number,
		&startDate,
		&endDate,
		&duration,
		&item.Inspection.Letter.NumberLeft,
		&letterDate,
		&representativeDoc,
		&addressesJSON,
		&inspectorsJSON,
		&signaturesJSON,
		&representativesJSON,
		&item.CreatedBy,
		&item.UpdatedBy,
		&createdAt,
		&updatedAt,
	); err != nil {
		return inspectionResponse{}, err
	}

	item.Inspection.MzOrder.Date = formatDate(mzOrderDate)
	item.Inspection.Period.StartDate = formatDate(startDate)
	item.Inspection.Period.EndDate = formatDate(endDate)
	item.Inspection.Period.Days = formatDays(duration)
	item.Inspection.Letter.Date = formatDate(letterDate)
	item.Inspection.Letter.NumberLeft, item.Inspection.Letter.NumberRight = splitLetterNumber(item.Inspection.Letter.NumberLeft)
	item.Inspection.Representative = []string{}
	addresses, err := unmarshalStringSlice(addressesJSON)
	if err != nil {
		return inspectionResponse{}, err
	}
	inspectors, err := unmarshalStringSlice(inspectorsJSON)
	if err != nil {
		return inspectionResponse{}, err
	}
	signatures, err := unmarshalStringSlice(signaturesJSON)
	if err != nil {
		return inspectionResponse{}, err
	}
	representatives, err := unmarshalStringSlice(representativesJSON)
	if err != nil {
		return inspectionResponse{}, err
	}

	item.Inspection.AddressNoIndex = addresses
	item.Inspection.Inspectors = inspectors
	item.Inspection.Signatures = signatures
	if len(representatives) > 0 {
		item.Inspection.Representative = representatives
	} else if representativeDoc.Valid && representativeDoc.String != "" {
		item.Inspection.Representative = []string{representativeDoc.String}
	}

	item.CreatedAt = createdAt.Format(time.RFC3339)
	item.UpdatedAt = updatedAt.Format(time.RFC3339)

	return item, nil
}

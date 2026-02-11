package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"strings"
)

type verificationArea struct {
	ID        string                     `json:"id"`
	Level1    string                     `json:"level1"`
	Level2    []verificationAreaLevel2   `json:"level2"`
	Templates []verificationAreaTemplate `json:"templates"`
}

type verificationAreaLevel2 struct {
	ID     string                   `json:"id"`
	Name   string                   `json:"name"`
	Level3 []verificationAreaLevel3 `json:"level3"`
}

type verificationAreaLevel3 struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type verificationAreaTemplate struct {
	ID   string   `json:"id"`
	Name string   `json:"name"`
	Tags []string `json:"tags"`
}

type verificationAreasResponse struct {
	Items []verificationArea `json:"items"`
}

type verificationAreasUpsertRequest struct {
	Items []verificationArea `json:"items"`
}

func normalizeVerificationAreas(items []verificationArea) []verificationArea {
	if len(items) == 0 {
		return []verificationArea{}
	}

	normalized := make([]verificationArea, 0, len(items))
	for _, area := range items {
		area.Level1 = strings.TrimSpace(area.Level1)

		if area.Level2 == nil {
			area.Level2 = []verificationAreaLevel2{}
		}
		for l2Index := range area.Level2 {
			area.Level2[l2Index].Name = strings.TrimSpace(area.Level2[l2Index].Name)
			if area.Level2[l2Index].Level3 == nil {
				area.Level2[l2Index].Level3 = []verificationAreaLevel3{}
			}
			for l3Index := range area.Level2[l2Index].Level3 {
				area.Level2[l2Index].Level3[l3Index].Name = strings.TrimSpace(area.Level2[l2Index].Level3[l3Index].Name)
			}
		}

		if area.Templates == nil {
			area.Templates = []verificationAreaTemplate{}
		}
		for templateIndex := range area.Templates {
			area.Templates[templateIndex].Name = strings.TrimSpace(area.Templates[templateIndex].Name)
			if area.Templates[templateIndex].Tags == nil {
				area.Templates[templateIndex].Tags = []string{}
			}
			for tagIndex := range area.Templates[templateIndex].Tags {
				area.Templates[templateIndex].Tags[tagIndex] = strings.TrimSpace(area.Templates[templateIndex].Tags[tagIndex])
			}
		}

		normalized = append(normalized, area)
	}

	return normalized
}

func (s *server) fetchVerificationAreas(ctx context.Context) ([]verificationArea, error) {
	var raw []byte
	err := s.db.QueryRowContext(ctx, `
		SELECT payload
		FROM verification_areas_store
		WHERE id=1
	`).Scan(&raw)
	if err != nil {
		if err == sql.ErrNoRows {
			return []verificationArea{}, nil
		}
		return nil, err
	}

	var items []verificationArea
	if err := json.Unmarshal(raw, &items); err != nil {
		return nil, err
	}
	return normalizeVerificationAreas(items), nil
}

func (s *server) replaceVerificationAreas(ctx context.Context, items []verificationArea) error {
	raw, err := json.Marshal(items)
	if err != nil {
		return err
	}

	_, err = s.db.ExecContext(ctx, `
		INSERT INTO verification_areas_store (id, payload)
		VALUES (1, ?)
		ON DUPLICATE KEY UPDATE payload=VALUES(payload)
	`, raw)
	return err
}

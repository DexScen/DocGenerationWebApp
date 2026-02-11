package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"
)

func decodeInspectionPayload(r *http.Request) (actPayload, error) {
	var payload actPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		return payload, errors.New("Некорректный формат запроса")
	}
	return payload, nil
}

func buildLetterNumber(letter letterDTO) string {
	left := strings.TrimSpace(letter.NumberLeft)
	right := strings.TrimSpace(letter.NumberRight)
	if left == "" && right == "" {
		return ""
	}
	if left != "" && right != "" {
		return left + "/" + right
	}
	return left + right
}

func splitLetterNumber(value string) (string, string) {
	parts := strings.SplitN(strings.TrimSpace(value), "/", 2)
	if len(parts) == 2 {
		return strings.TrimSpace(parts[0]), strings.TrimSpace(parts[1])
	}
	return strings.TrimSpace(value), ""
}

func buildAddresses(payload actPayload) []string {
	return normalizeStringList(payload.Inspection.AddressNoIndex)
}

func buildRepresentatives(payload actPayload) []string {
	return normalizeStringList(payload.Inspection.Representative)
}

func normalizeStringList(values []string) []string {
	var normalized []string
	for _, value := range values {
		item := strings.TrimSpace(value)
		if item == "" {
			continue
		}
		normalized = append(normalized, item)
	}
	return normalized
}

func marshalStringSlice(values []string) ([]byte, error) {
	if values == nil {
		values = []string{}
	}
	return json.Marshal(values)
}

func unmarshalStringSlice(data []byte) ([]string, error) {
	if len(data) == 0 {
		return []string{}, nil
	}
	var values []string
	if err := json.Unmarshal(data, &values); err != nil {
		return nil, err
	}
	return values, nil
}

func parseDate(value string) *time.Time {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	parsed, err := time.Parse(dateLayout, value)
	if err != nil {
		return nil
	}
	return &parsed
}

func formatDate(value sql.NullTime) string {
	if !value.Valid {
		return ""
	}
	return value.Time.Format(dateLayout)
}

func formatDays(value sql.NullInt64) string {
	if !value.Valid {
		return ""
	}
	return strconv.FormatInt(value.Int64, 10)
}

func firstOrEmpty(values []string) string {
	if len(values) == 0 {
		return ""
	}
	return values[0]
}

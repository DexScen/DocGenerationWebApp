package main

import (
	"encoding/json"
	"strings"
)

type stringList []string

func (s *stringList) UnmarshalJSON(data []byte) error {
	if len(data) == 0 || string(data) == "null" {
		*s = []string{}
		return nil
	}

	var list []string
	if err := json.Unmarshal(data, &list); err == nil {
		*s = normalizeStringList(list)
		return nil
	}

	var single string
	if err := json.Unmarshal(data, &single); err != nil {
		return err
	}

	items := strings.Split(single, ",")
	*s = normalizeStringList(items)
	return nil
}

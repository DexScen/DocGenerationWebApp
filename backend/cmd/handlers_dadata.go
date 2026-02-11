package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"strings"
	"time"
)

type dadataOrgRequest struct {
	Ogrn string `json:"ogrn"`
}

type dadataOrgResponse struct {
	Name               string `json:"name"`
	ShortName          string `json:"shortName"`
	LegalAddress       string `json:"legalAddress"`
	BossRole           string `json:"bossRole"`
	BossNamePatronymic string `json:"bossNamePatronymic"`
	BossLastName       string `json:"bossLastName"`
}

type dadataPartyResponse struct {
	Suggestions []struct {
		Data struct {
			Name struct {
				FullWithOpf  string `json:"full_with_opf"`
				ShortWithOpf string `json:"short_with_opf"`
			} `json:"name"`
			Address struct {
				Value string `json:"value"`
			} `json:"address"`
			Management *struct {
				Post string `json:"post"`
				Name string `json:"name"`
			} `json:"management"`
		} `json:"data"`
	} `json:"suggestions"`
}

func (s *server) handleDadataOrganization(w http.ResponseWriter, r *http.Request, authUser user) {
	var payload dadataOrgRequest
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "Некорректный формат запроса")
		return
	}

	ogrn := strings.TrimSpace(payload.Ogrn)
	if len(ogrn) != 13 || !isDigits(ogrn) {
		writeError(w, http.StatusBadRequest, "ОГРН должен содержать 13 цифр")
		return
	}

	apiKey := getEnv("DADATA_API_KEY", "")
	secret := getEnv("DADATA_SECRET", "")
	if apiKey == "" || secret == "" {
		writeError(w, http.StatusInternalServerError, "Dadata ключи не настроены")
		return
	}

	requestBody, err := json.Marshal(map[string]string{"query": ogrn})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Не удалось подготовить запрос")
		return
	}

	request, err := http.NewRequest(http.MethodPost, "https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party", bytes.NewReader(requestBody))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Не удалось создать запрос")
		return
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Accept", "application/json")
	request.Header.Set("Authorization", "Token "+apiKey)
	request.Header.Set("X-Secret", secret)

	client := &http.Client{Timeout: 10 * time.Second}
	response, err := client.Do(request)
	if err != nil {
		writeError(w, http.StatusBadGateway, "Не удалось получить данные по ОГРН")
		return
	}
	defer response.Body.Close()

	if response.StatusCode < 200 || response.StatusCode >= 300 {
		writeError(w, http.StatusBadGateway, "Ошибка ответа Dadata")
		return
	}

	var dadataResponse dadataPartyResponse
	if err := json.NewDecoder(response.Body).Decode(&dadataResponse); err != nil {
		writeError(w, http.StatusBadGateway, "Не удалось обработать ответ Dadata")
		return
	}

	if len(dadataResponse.Suggestions) == 0 {
		writeError(w, http.StatusNotFound, "Организация не найдена")
		return
	}

	data := dadataResponse.Suggestions[0].Data
	result := dadataOrgResponse{
		Name:         data.Name.FullWithOpf,
		ShortName:    data.Name.ShortWithOpf,
		LegalAddress: data.Address.Value,
	}

	if data.Management != nil {
		result.BossRole = data.Management.Post
		result.BossLastName, result.BossNamePatronymic = splitManagerName(data.Management.Name)
	}

	writeJSON(w, http.StatusOK, result)
}

func splitManagerName(fullName string) (string, string) {
	parts := strings.Fields(fullName)
	if len(parts) == 0 {
		return "", ""
	}
	lastName := parts[0]
	if len(parts) == 1 {
		return lastName, ""
	}
	return lastName, strings.Join(parts[1:], " ")
}

func isDigits(value string) bool {
	for _, ch := range value {
		if ch < '0' || ch > '9' {
			return false
		}
	}
	return true
}

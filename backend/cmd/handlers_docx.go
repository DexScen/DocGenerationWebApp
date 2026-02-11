package main

import (
	"archive/zip"
	"bytes"
	"database/sql"
	"encoding/xml"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/gorilla/mux"
)

const docxContentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

func (s *server) handleInspectionDocx(w http.ResponseWriter, r *http.Request, authUser user) {
	id, err := parseID(mux.Vars(r)["id"])
	if err != nil {
		writeError(w, http.StatusBadRequest, "Некорректный идентификатор")
		return
	}
	item, err := s.fetchInspectionByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "Проверка не найдена")
			return
		}
		writeError(w, http.StatusInternalServerError, "Не удалось сформировать документ")
		return
	}

	docxBytes, err := buildInspectionDocx(item)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Не удалось сформировать документ")
		return
	}

	filename := fmt.Sprintf("inspection-%d.docx", item.ID)
	w.Header().Set("Content-Type", docxContentType)
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", filename))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(docxBytes)
}

func buildInspectionDocx(item inspectionResponse) ([]byte, error) {
	lines := inspectionDocxLines(item)
	documentXML, err := buildDocxDocumentXML(lines)
	if err != nil {
		return nil, err
	}

	var buf bytes.Buffer
	zipWriter := zip.NewWriter(&buf)
	if err := addDocxFile(zipWriter, "[Content_Types].xml", docxContentTypesXML); err != nil {
		return nil, err
	}
	if err := addDocxFile(zipWriter, "_rels/.rels", docxRootRelsXML); err != nil {
		return nil, err
	}
	if err := addDocxFile(zipWriter, "word/document.xml", documentXML); err != nil {
		return nil, err
	}
	if err := zipWriter.Close(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func addDocxFile(zipWriter *zip.Writer, name, contents string) error {
	writer, err := zipWriter.Create(name)
	if err != nil {
		return err
	}
	_, err = writer.Write([]byte(contents))
	return err
}

func inspectionDocxLines(item inspectionResponse) []string {
	letterNumber := buildLetterNumber(item.Inspection.Letter)
	headName := strings.TrimSpace(strings.Join([]string{
		item.Head.LastName,
		item.Head.NamePatronymic,
		item.Head.LastNameTo,
	}, " "))

	lines := []string{
		"АКТ ПРОВЕРКИ",
		"",
		fmt.Sprintf("Организация: %s", formatValue(item.Organization.Name)),
		fmt.Sprintf("Краткое наименование: %s", formatValue(item.Organization.ShortName)),
		fmt.Sprintf("ОГРН: %s", formatValue(item.Organization.Ogrn)),
		fmt.Sprintf("Юридический адрес: %s", formatValue(item.Organization.Address.LegalAddress)),
		fmt.Sprintf("Почтовый адрес: %s", formatValue(item.Organization.Address.PostalAddress)),
		"",
		fmt.Sprintf("Форма проверки: %s", formatValue(item.Inspection.FormType)),
		fmt.Sprintf("Приказ Минздрава: №%s от %s", formatValue(item.Inspection.MzOrder.Number), formatValue(item.Inspection.MzOrder.Date)),
		fmt.Sprintf("Письмо: №%s от %s", formatValue(letterNumber), formatValue(item.Inspection.Letter.Date)),
		fmt.Sprintf("Срок проверки: %s — %s (%s раб. дней)", formatValue(item.Inspection.Period.StartDate), formatValue(item.Inspection.Period.EndDate), formatValue(item.Inspection.Period.Days)),
		"",
		fmt.Sprintf("Руководитель учреждения: %s %s", formatValue(item.Head.Role), formatValue(headName)),
		fmt.Sprintf("Представитель учреждения: %s", formatList(item.Inspection.Representative)),
		fmt.Sprintf("Инспекторы: %s", formatList(item.Inspection.Inspectors)),
		fmt.Sprintf("Адреса проверки: %s", formatList(item.Inspection.AddressNoIndex)),
		fmt.Sprintf("Подписи: %s", formatList(item.Inspection.Signatures)),
		"",
		fmt.Sprintf("Создал: %s", formatValue(item.CreatedBy)),
		fmt.Sprintf("Обновил: %s", formatValue(item.UpdatedBy)),
	}
	return lines
}

func formatValue(value string) string {
	if strings.TrimSpace(value) == "" {
		return "—"
	}
	return value
}

func formatList(values []string) string {
	if len(values) == 0 {
		return "—"
	}
	var filtered []string
	for _, value := range values {
		if strings.TrimSpace(value) == "" {
			continue
		}
		filtered = append(filtered, value)
	}
	if len(filtered) == 0 {
		return "—"
	}
	return strings.Join(filtered, ", ")
}

func buildDocxDocumentXML(lines []string) (string, error) {
	var builder strings.Builder
	builder.WriteString(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`)
	builder.WriteString(`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">`)
	builder.WriteString(`<w:body>`)

	for _, line := range lines {
		if line == "" {
			builder.WriteString(`<w:p/>`)
			continue
		}
		builder.WriteString(`<w:p><w:r><w:t xml:space="preserve">`)
		if err := writeEscapedXML(&builder, line); err != nil {
			return "", err
		}
		builder.WriteString(`</w:t></w:r></w:p>`)
	}

	builder.WriteString(`<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>`)
	builder.WriteString(`</w:body></w:document>`)
	return builder.String(), nil
}

func writeEscapedXML(builder *strings.Builder, value string) error {
	var buf bytes.Buffer
	if err := xml.EscapeText(&buf, []byte(value)); err != nil {
		return err
	}
	builder.WriteString(buf.String())
	return nil
}

const docxContentTypesXML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>
`

const docxRootRelsXML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>
`

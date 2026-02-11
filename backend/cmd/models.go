package main

type user struct {
	ID       int    `json:"id"`
	Name     string `json:"name"`
	Login    string `json:"login"`
	Password string `json:"password,omitempty"`
	Role     string `json:"role"`
}

type employee struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

type actPayload struct {
	CreatedBy    string          `json:"created_by"`
	Organization organizationDTO `json:"organization"`
	Head         headDTO         `json:"head"`
	Inspection   inspectionDTO   `json:"inspection"`
}

type organizationDTO struct {
	Ogrn      string     `json:"ogrn"`
	Name      string     `json:"name"`
	ShortName string     `json:"shortName"`
	Address   addressDTO `json:"address"`
}

type addressDTO struct {
	LegalAddress  string `json:"legalAddress"`
	PostalAddress string `json:"postalAddress"`
}

type headDTO struct {
	Role           string `json:"role"`
	NamePatronymic string `json:"namePatronymic"`
	LastName       string `json:"lastName"`
	LastNameTo     string `json:"lastNameTo"`
}

type inspectionDTO struct {
	FormType       string     `json:"formType"`
	MzOrder        orderDTO   `json:"mzOrder"`
	Number         string     `json:"number"`
	Period         periodDTO  `json:"period"`
	Letter         letterDTO  `json:"letter"`
	AddressNoIndex stringList `json:"addressNoIndex"`
	Representative stringList `json:"representative"`
	Inspectors     []string   `json:"inspectors"`
	Signatures     []string   `json:"signatures"`
}

type orderDTO struct {
	Number string `json:"number"`
	Date   string `json:"date"`
}

type periodDTO struct {
	StartDate string `json:"startDate"`
	EndDate   string `json:"endDate"`
	Days      string `json:"days"`
}

type letterDTO struct {
	NumberLeft  string `json:"numberLeft"`
	NumberRight string `json:"numberRight"`
	Date        string `json:"date"`
}

type inspectionResponse struct {
	ID           int             `json:"id"`
	CreatedAt    string          `json:"created_at"`
	UpdatedAt    string          `json:"updated_at"`
	CreatedBy    string          `json:"created_by"`
	UpdatedBy    string          `json:"updated_by"`
	Organization organizationDTO `json:"organization"`
	Head         headDTO         `json:"head"`
	Inspection   inspectionDTO   `json:"inspection"`
}

type inspectionListResponse struct {
	Items    []inspectionResponse `json:"items"`
	Total    int                  `json:"total"`
	Page     int                  `json:"page"`
	PageSize int                  `json:"page_size"`
}

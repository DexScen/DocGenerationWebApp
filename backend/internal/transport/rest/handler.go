package rest

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strconv"

	"github.com/DexScen/DocGenerationWebApp/backend/internal/domain"
	e "github.com/DexScen/DocGenerationWebApp/backend/internal/errors"
	"github.com/gorilla/mux"
)

type Docs interface {
	GetAllOrganizations(ctx context.Context) ([]domain.Organization, error)
	PostNewOrganization(ctx context.Context, org domain.Organization) error
	DeleteOrganizationByID(ctx context.Context, org_id int) error
	PutOrganizationByID(ctx context.Context, org domain.Organization, org_id int) error

	GetLeadersByOrgID(ctx context.Context, org_id int) ([]domain.Leader, error)
	PostLeaderByOrgID(ctx context.Context, leader domain.Leader, org_id int) error
	DeleteLeaderByID(ctx context.Context, id int) error

	GetAllInspectionsForHistory(ctx context.Context) ([]domain.InspectionHistoryItem, error)
	GetInspectionByID(ctx context.Context, id int) (domain.Inspection, error)
}

type Handler struct {
	docsService Docs
}

func NewDocs(docs Docs) *Handler {
	return &Handler{
		docsService: docs,
	}
}

func (h *Handler) InitRouter() *mux.Router {
	r := mux.NewRouter().StrictSlash(true)
	r.Use(loggingMiddleware)
	r.Use(corsMiddleware)

	links := r.PathPrefix("").Subrouter()
	{
		links.HandleFunc("/organizations", h.GetAllOrganizations).Methods(http.MethodGet)
		links.HandleFunc("/organizations", h.PostNewOrganization).Methods(http.MethodPost)
		links.HandleFunc("/organizations/{id}", h.DeleteOrganizationByID).Methods(http.MethodDelete)
		links.HandleFunc("/organizations/{id}", h.PutOrganizationByID).Methods(http.MethodPut)

		links.HandleFunc("/leaders/{id}", h.DeleteLeaderByID).Methods(http.MethodDelete)
		links.HandleFunc("/leaders/{id}", h.GetLeadersByOrgID).Methods(http.MethodGet) // ORG_ID а не leaderID
		links.HandleFunc("/leaders/{id}", h.PostLeaderByOrgID).Methods(http.MethodPost)

		links.HandleFunc("/inspections", h.GetAllInspectionsForHistory).Methods(http.MethodGet)
		links.HandleFunc("/inspections/{id}", h.GetInspectionByID).Methods(http.MethodGet)
	}
	return r
}

func (h *Handler) GetAllOrganizations(w http.ResponseWriter, r *http.Request) {
	list, err := h.docsService.GetAllOrganizations(context.TODO())
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		log.Println("GetAllOrganizations error:", err)
		return
	}

	if jsonResp, err := json.Marshal(list); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		log.Println("GetAllOrganizations error:", err)
		return
	} else {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write(jsonResp)
	}
}

func (h *Handler) PostNewOrganization(w http.ResponseWriter, r *http.Request) {
	var org domain.Organization
	if err := json.NewDecoder(r.Body).Decode(&org); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		log.Println("PostNewOrganization error:", err)
		return
	}

	err := h.docsService.PostNewOrganization(context.TODO(), org)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		log.Println("PostNewOrganization error:", err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
}

func (h *Handler) GetLeadersByOrgID(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	idStr := vars["id"]
	id, err := strconv.Atoi(idStr)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		log.Println("GetLeadersByOrgID error:", err)
		return
	}

	leaders, err := h.docsService.GetLeadersByOrgID(context.TODO(), id)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		log.Println("GetLeadersByOrgID error:", err)
		return
	}

	if jsonResp, err := json.Marshal(leaders); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		log.Println("GetLeadersByOrgID error:", err)
		return
	} else {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write(jsonResp)
	}
}

func (h *Handler) PostLeaderByOrgID(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	idStr := vars["id"]
	id, err := strconv.Atoi(idStr)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		log.Println("PostLeaderByOrgID error:", err)
		return
	}

	var leader domain.Leader
	if err := json.NewDecoder(r.Body).Decode(&leader); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		log.Println("PostLeaderByOrgID error:", err)
		return
	}

	if err := h.docsService.PostLeaderByOrgID(context.TODO(), leader, id); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		log.Println("PostLeaderByOrgID error:", err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
}

func (h *Handler) DeleteOrganizationByID(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	idStr := vars["id"]
	id, err := strconv.Atoi(idStr)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		log.Println("DeleteOrganizationByID error:", err)
		return
	}

	if err := h.docsService.DeleteOrganizationByID(context.TODO(), id); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		log.Println("DeleteOrganizationByID error:", err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusGone)
}

func (h *Handler) DeleteLeaderByID(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	idStr := vars["id"]
	id, err := strconv.Atoi(idStr)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		log.Println("DeleteLeaderByID error:", err)
		return
	}

	if err := h.docsService.DeleteLeaderByID(context.TODO(), id); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		log.Println("DeleteLeaderByID error:", err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusGone)
}

func (h *Handler) PutOrganizationByID(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	idStr := vars["id"]
	id, err := strconv.Atoi(idStr)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		log.Println("PutOrganizationByID error:", err)
		return
	}

	var org domain.Organization
	if err := json.NewDecoder(r.Body).Decode(&org); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		log.Println("PutOrganizationByID error:", err)
		return
	}

	if err := h.docsService.PutOrganizationByID(context.TODO(), org, id); err != nil { //err no such id
		if errors.Is(err, e.ErrOrganizationNotFound) {
			w.WriteHeader(http.StatusNotFound)
			log.Println("PutOrganization error:", err)
			return
		} else {
			w.WriteHeader(http.StatusInternalServerError)
			log.Println("PutOrganization error:", err)
			return
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
}

func (h *Handler) GetAllInspectionsForHistory(w http.ResponseWriter, r *http.Request){
	list, err := h.docsService.GetAllInspectionsForHistory(context.TODO())
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		log.Println("GetAllInspectionsForHistory error:", err)
		return
	}

	if jsonResp, err := json.Marshal(list); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		log.Println("GetAllInspectionsForHistory error:", err)
		return
	} else {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write(jsonResp)
	}
}

func (h *Handler) GetInspectionByID(w http.ResponseWriter, r *http.Request){
	vars := mux.Vars(r)
	idStr := vars["id"]
	id, err := strconv.Atoi(idStr)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		log.Println("GetInspectionByID error:", err)
		return
	}

	inspection, err := h.docsService.GetInspectionByID(context.TODO(), id)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		log.Println("GetInspectionByID error:", err)
		return
	}

	if jsonResp, err := json.Marshal(inspection); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		log.Println("GetInspectionByID error:", err)
		return
	} else {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write(jsonResp)
	}
}
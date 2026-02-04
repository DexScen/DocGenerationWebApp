package service

import (
	"context"
	"errors"

	"github.com/DexScen/DocGenerationWebApp/backend/internal/domain"
	e "github.com/DexScen/DocGenerationWebApp/backend/internal/errors"
)

type DocsRepository interface {
	GetAllOrganizations(ctx context.Context) ([]domain.Organization, error)
	PostNewOrganization(ctx context.Context, org domain.Organization) error
	DeleteOrganizationByID(ctx context.Context, org_id int) error
	PutOrganizationByID(ctx context.Context, org domain.Organization, org_id int) error

	GetLeadersByOrgID(ctx context.Context, org_id int) ([]domain.Leader, error)
	PostLeaderByOrgID(ctx context.Context, leader domain.Leader, org_id int) error
	DeleteLeaderByID(ctx context.Context, id int) error
}

type Docs struct {
	repo DocsRepository
}

func NewDocs(repo DocsRepository) *Docs {
	return &Docs{
		repo: repo,
	}
}

func (d *Docs) GetAllOrganizations(ctx context.Context) ([]domain.Organization, error) {
	return d.repo.GetAllOrganizations(ctx)
}

func (d *Docs) PostNewOrganization(ctx context.Context, org domain.Organization) error {
	return d.repo.PostNewOrganization(ctx, org)
}

func (d *Docs) GetLeadersByOrgID(ctx context.Context, org_id int) ([]domain.Leader, error) {
	return d.repo.GetLeadersByOrgID(ctx, org_id)
}

func (d *Docs) PostLeaderByOrgID(ctx context.Context, leader domain.Leader, org_id int) error {
	return d.repo.PostLeaderByOrgID(ctx, leader, org_id)
}

func (d *Docs) DeleteOrganizationByID(ctx context.Context, org_id int) error {
	err := d.repo.DeleteOrganizationByID(ctx, org_id)
	if errors.Is(err, e.ErrOrganizationNotFound){
		return nil
	}
	return err
}

func (d *Docs) DeleteLeaderByID(ctx context.Context, id int) error{
	err := d.repo.DeleteLeaderByID(ctx, id)
	if errors.Is(err, e.ErrLeaderNotFound){
		return nil
	}
	return err
}

func (d *Docs) PutOrganizationByID(ctx context.Context, org domain.Organization, org_id int) error{
	return d.repo.PutOrganizationByID(ctx, org, org_id)
}
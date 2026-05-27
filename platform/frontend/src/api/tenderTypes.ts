import type { Tender, TenderRequirement } from './domainTypes';

export type TenderFormState = {
  opportunityId: string;
  title: string;
  reference: string;
  buyerName: string;
};

export type RequirementFormState = {
  code: string;
  section: string;
  description: string;
};

export type TenderWorkspaceState = {
  tenders: Tender[];
  requirements: TenderRequirement[];
  selectedTenderId: number | null;
};

export const emptyTenderForm: TenderFormState = {
  opportunityId: '',
  title: '',
  reference: '',
  buyerName: '',
};

export const emptyRequirementForm: RequirementFormState = {
  code: '',
  section: '',
  description: '',
};

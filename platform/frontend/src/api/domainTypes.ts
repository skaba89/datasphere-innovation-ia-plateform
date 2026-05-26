export type Organization = {
  id: number;
  name: string;
  country?: string | null;
  sector?: string | null;
  organization_type?: string | null;
  website?: string | null;
  description?: string | null;
  created_at: string;
  updated_at: string;
};

export type Opportunity = {
  id: number;
  organization_id: number;
  title: string;
  opportunity_type?: string | null;
  country?: string | null;
  sector?: string | null;
  status: string;
  priority: string;
  probability: number;
  owner_name?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
};

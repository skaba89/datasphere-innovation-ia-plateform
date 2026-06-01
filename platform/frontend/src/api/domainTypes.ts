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

export type Tender = {
  id: number;
  opportunity_id: number;
  reference?: string | null;
  title: string;
  buyer_name?: string | null;
  publication_date?: string | null;
  submission_deadline?: string | null;
  source_url?: string | null;
  summary?: string | null;
  go_no_go_score?: number | null;
  go_no_go_decision?: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type TenderRequirement = {
  id: number;
  tender_id: number;
  requirement_code?: string | null;
  section?: string | null;
  description: string;
  requirement_type?: string | null;
  response_strategy?: string | null;
  proof_or_deliverable?: string | null;
  owner_name?: string | null;
  status: string;
  comments?: string | null;
  created_at: string;
  updated_at: string;
};

export type GoNoGoCriterion = {
  id: number;
  tender_id: number;
  name: string;
  description?: string | null;
  score: number;
  weight: number;
  max_score: number;
  rationale?: string | null;
  recommendation?: string | null;
  created_at: string;
  updated_at: string;
};

export type GoNoGoSummary = {
  tender_id: number;
  criteria_count: number;
  weighted_score: number;
  max_weighted_score: number;
  percentage: number;
  recommendation: string;
};

export type ComplianceMatrixItem = {
  id: number;
  tender_id: number;
  requirement_id?: number | null;
  requirement_code?: string | null;
  requirement_summary: string;
  compliance_status: string;
  response_location?: string | null;
  evidence?: string | null;
  gap?: string | null;
  action_plan?: string | null;
  owner_name?: string | null;
  due_date?: string | null;
  comments?: string | null;
  created_at: string;
  updated_at: string;
};

export type ComplianceSummary = {
  tender_id: number;
  total_items: number;
  compliant: number;
  partial: number;
  gap: number;
  to_review: number;
  compliance_rate: number;
};

export type AgentProfile = {
  id: number;
  name: string;
  slug: string;
  domain: string;
  seniority: string;
  languages: string;
  mission_types?: string | null;
  description?: string | null;
  instruction_template: string;
  tools?: string | null;
  governance_rules?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type AgentAssignment = {
  id: number;
  agent_id: number;
  opportunity_id?: number | null;
  tender_id?: number | null;
  assignment_type: string;
  objective: string;
  expected_deliverable?: string | null;
  priority: string;
  status: string;
  human_reviewer?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
};

export type AgentAction = {
  id: number;
  assignment_id: number;
  action_type: string;
  title: string;
  description?: string | null;
  priority: string;
  status: string;
  requires_human_approval: boolean;
  approved_by?: string | null;
  approved_at?: string | null;
  executed_at?: string | null;
  result_summary?: string | null;
  next_step?: string | null;
  created_at: string;
  updated_at: string;
};

export type Deliverable = {
  id: number;
  opportunity_id?: number | null;
  tender_id?: number | null;
  assignment_id?: number | null;
  action_id?: number | null;
  title: string;
  deliverable_type: string;
  status: string;
  version: number;
  language: string;
  audience?: string | null;
  summary?: string | null;
  content_markdown: string;
  tags?: string | null;
  generated_by?: string | null;
  reviewed_by?: string | null;
  approved_by?: string | null;
  reviewed_at?: string | null;
  approved_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type DeliverableSection = {
  id: number;
  deliverable_id: number;
  title: string;
  section_key: string;
  position: number;
  status: string;
  content_markdown: string;
  version: number;
  owner_agent_id?: number | null;
  reviewed_by?: string | null;
  approved_by?: string | null;
  reviewed_at?: string | null;
  approved_at?: string | null;
  created_at: string;
  updated_at: string;
};

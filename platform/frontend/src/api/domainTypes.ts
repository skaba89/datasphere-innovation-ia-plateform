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

// ── Scheduler ──────────────────────────────────────────────────────────────

export type JobInfo = {
  id: string;
  name: string;
  next_run_time?: string | null;
  trigger: string;
};

export type SchedulerStatus = {
  running: boolean;
  jobs: JobInfo[];
  pending_approvals_count: number;
  timezone: string;
};

export type SchedulerLog = {
  id: number;
  job_id: string;
  job_name: string;
  status: "success" | "error" | "warning";
  items_processed: number;
  error_message?: string | null;
  started_at: string;
  finished_at?: string | null;
  duration_ms?: number | null;
  created_at: string;
};

// ── Analytics ──────────────────────────────────────────────────────────────

export type OpportunityStats = {
  total: number;
  by_status: Record<string, number>;
  by_priority: Record<string, number>;
  high_priority: number;
  won: number;
  lost: number;
  pipeline_value: number;
  total_potential: number;
  avg_probability: number;
};

export type TenderStats = {
  total: number;
  by_status: Record<string, number>;
  by_decision: Record<string, number>;
  go_count: number;
  no_go_count: number;
  avg_go_score: number;
  deadlines_this_week: number;
};

export type AgentStats = {
  total_profiles: number;
  total_assignments: number;
  total_actions: number;
  actions_done: number;
  actions_pending: number;
  actions_failed: number;
  actions_pending_approval: number;
  completion_rate: number;
};

export type DeliverableStats = {
  total: number;
  by_status: Record<string, number>;
  draft: number;
  in_review: number;
  approved: number;
  approval_rate: number;
};

export type SchedulerStats = {
  running: boolean;
  jobs_count: number;
  last_execution: string | null;
  executions_today: number;
  errors_today: number;
};

export type NotificationItem = {
  type: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  detail: string;
  resource_type: string;
  resource_id: number;
  created_at: string;
};

export type PipelineAnalytics = {
  opportunities: OpportunityStats;
  tenders: TenderStats;
  agents: AgentStats;
  deliverables: DeliverableStats;
  scheduler: SchedulerStats;
  notifications: NotificationItem[];
  computed_at: string;
};

// ── Audit log ────────────────────────────────────────────────────────────

export type AuditLog = {
  id: number;
  user_email?: string | null;
  actor_name?: string | null;
  action: string;
  resource_type: string;
  resource_id?: number | null;
  resource_label?: string | null;
  detail?: string | null;
  status: string;
  created_at: string;
};

// ── Commercial features ─────────────────────────────────────────────────────

export type GoNoGoRiskItem = {
  level: 'high' | 'medium' | 'low';
  category: string;
  description: string;
  mitigation: string;
};

export type GoNoGoOpportunityItem = {
  category: string;
  description: string;
  impact: 'fort' | 'moyen' | 'faible';
};

export type GoNoGoRecommendation = {
  tender_id: number;
  decision: 'Go' | 'No-Go' | 'Go conditionnel';
  confidence: number;
  score_global: number;
  score_percentage: number;
  summary: string;
  reasoning: string;
  risks: GoNoGoRiskItem[];
  opportunities: GoNoGoOpportunityItem[];
  conditions: string[];
  recommended_actions: string[];
  provider: string;
  computed_at: string;
};

export type SectorTemplate = {
  id: number;
  sector_key: string;
  sector_label: string;
  deliverable_type: string;
  title_template: string;
  description: string;
  tags: string;
  is_builtin: boolean;
  created_at: string;
};

export type EmailPreview = {
  deliverable_id: number;
  subject: string;
  to_name: string;
  to_email: string;
  from_name: string;
  html_body: string;
  text_body: string;
  attachments_note: string;
};

// ── CRM Contacts ────────────────────────────────────────────────────────────

export type Contact = {
  id: number;
  organization_id: number;
  first_name?: string | null;
  last_name?: string | null;
  job_title?: string | null;
  professional_email?: string | null;
  linkedin_url?: string | null;
  source?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
};

// ── Pipeline kanban ──────────────────────────────────────────────────────────

export type PipelineItem = {
  id: number;
  title: string;
  org_name: string;
  priority: string;
  probability: number;
  potential_value: number;
  pipeline_value: number;
  owner_name?: string | null;
  next_action?: string | null;
  sector?: string | null;
  country?: string | null;
  created_at: string;
};

export type PipelineColumn = {
  status: string;
  items: PipelineItem[];
  total_value: number;
  pipeline_value: number;
};

// ── Team ─────────────────────────────────────────────────────────────────────

export type User = {
  id: number;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  role: 'admin' | 'manager' | 'consultant' | 'viewer';
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

// ── Versioning ───────────────────────────────────────────────────────────────

export type DeliverableVersionItem = {
  id: number;
  deliverable_id: number;
  version: number;
  title: string;
  status: string;
  summary?: string | null;
  created_by?: string | null;
  change_note?: string | null;
  created_at: string;
};

// ── Search ───────────────────────────────────────────────────────────────────

export type SearchResultItem = {
  id: number;
  type: string;
  title: string;
  subtitle: string;
  url_hint: string;
};

export type SearchResults = {
  query: string;
  total: number;
  results: Record<string, SearchResultItem[]>;
};

// ── Activity feed ────────────────────────────────────────────────────────────

export type ActivityItem = {
  id: string;
  source: string;
  action: string;
  icon: string;
  color: string;
  title: string;
  detail: string;
  actor: string;
  resource_type: string;
  resource_id: number | null;
  timestamp: string;
  status: string;
};

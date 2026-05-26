# Modele de donnees initial

## Objectif

Definir les principales entites de la future plateforme DataSphere Innovation IA Platform.

Ce modele doit permettre de piloter les prospects, opportunites, appels d offres, agents, documents, missions et validations.

## Entites principales

### User

Utilisateur interne de la plateforme.

Champs :

- id
- first_name
- last_name
- email
- password_hash
- role
- is_active
- created_at
- updated_at

### Organization

Entreprise, institution ou partenaire.

Champs :

- id
- name
- country
- sector
- organization_type
- website
- description
- created_at
- updated_at

### Contact

Contact professionnel rattache a une organisation.

Champs :

- id
- organization_id
- first_name
- last_name
- job_title
- professional_email
- linkedin_url
- source
- notes
- created_at
- updated_at

### Opportunity

Opportunite commerciale ou strategique.

Champs :

- id
- organization_id
- title
- opportunity_type
- country
- sector
- status
- priority
- potential_value
- probability
- next_action
- next_action_date
- owner_id
- created_at
- updated_at

### Tender

Appel d offres public ou prive.

Champs :

- id
- opportunity_id
- reference
- title
- buyer_name
- publication_date
- submission_deadline
- source_url
- summary
- go_no_go_score
- go_no_go_decision
- status
- created_at
- updated_at

### TenderRequirement

Exigence extraite du cahier des charges.

Champs :

- id
- tender_id
- requirement_code
- section
- description
- requirement_type
- response_strategy
- proof_or_deliverable
- owner_id
- status
- comments
- created_at
- updated_at

### Agent

Agent IA specialise.

Champs :

- id
- name
- slug
- role_description
- system_prompt
- input_schema
- output_format
- governance_rules
- is_active
- created_at
- updated_at

### AgentRun

Execution ou utilisation d un agent.

Champs :

- id
- agent_id
- user_id
- opportunity_id
- tender_id
- input_text
- output_text
- status
- review_status
- created_at
- updated_at

### Document

Document stocke ou genere.

Champs :

- id
- organization_id
- opportunity_id
- tender_id
- title
- document_type
- file_path
- version
- status
- owner_id
- created_at
- updated_at

### Review

Revue qualite ou validation humaine.

Champs :

- id
- document_id
- reviewer_id
- review_type
- decision
- comments
- created_at
- updated_at

### Risk

Risque identifie sur une opportunite, mission ou appel d offres.

Champs :

- id
- opportunity_id
- tender_id
- title
- description
- severity
- probability
- mitigation
- owner_id
- status
- created_at
- updated_at

### ActivityLog

Journalisation des actions importantes.

Champs :

- id
- actor_id
- entity_type
- entity_id
- action
- details
- created_at

## Relations principales

- Organization possede plusieurs Contacts.
- Organization possede plusieurs Opportunities.
- Opportunity peut avoir un Tender.
- Tender possede plusieurs TenderRequirements.
- Agent possede plusieurs AgentRuns.
- Opportunity peut posseder plusieurs Documents.
- Document peut avoir plusieurs Reviews.
- Opportunity et Tender peuvent avoir plusieurs Risks.
- User peut etre owner, reviewer ou actor.

## Regles de securite donnees

- Les contacts doivent rester professionnels.
- Les secrets ne doivent jamais etre stockes en clair.
- Les documents sensibles doivent etre controles par droits d acces.
- Les actions importantes doivent etre journalisees.
- Les sorties IA doivent etre marquees comme non validees tant qu un humain ne les a pas relues.

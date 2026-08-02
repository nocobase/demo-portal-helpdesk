// Prompt that lets a visitor rebuild this app from scratch with their own
// coding agent. Derived from the live data model, pages and workflows of
// this portal, so it describes what the app actually is.
// English only - it is meant to be pasted into a coding agent.

export function buildReplicatePrompt() {
  return `Build a "Help Desk" app on NocoBase with your coding agent.

What it is: external customer support: tickets routed into queues with SLA policies, agent macros, a public help library and CSAT surveys.

Data model (collection - purpose; key fields):
  desk_article_categories - article categories
      fields: parentId, name
      relations: children -> desk_article_categories, parent -> desk_article_categories, articles -> desk_help_articles
  desk_csat - satisfaction score left on a resolved ticket
      fields: comment, score, ticket_id
      relations: ticket -> desk_tickets
  desk_help_articles - help articles
      fields: category (account|billing|bug|feature_request|other), helpful_yes, title, published, body, helpful_no, summary, article_category_id
      relations: article_category -> desk_article_categories
  desk_macros - canned replies an agent can insert
      fields: category (account|billing|bug|feature_request|question), body, title
  desk_queues - routing buckets tickets are assigned to
      fields: name
      relations: tickets -> desk_tickets
  desk_requesters - requesters
      fields: name, company, email
      relations: tickets -> desk_tickets
  desk_sla_policies - sla policies
      fields: priority (low|medium|high|urgent), response_mins, resolve_mins, name
      relations: tickets -> desk_tickets
  desk_ticket_messages - ticket messages
      fields: direction, content, authorId, ticketId
      relations: author -> users, ticket -> desk_tickets
  desk_ticket_notes - ticket notes
      fields: authorId, ticketId, content
      relations: author -> users, ticket -> desk_tickets
  desk_ticket_types - ticket types
      fields: name
      relations: tickets -> desk_tickets
  desk_tickets - tickets
      fields: priority (high|low|medium|urgent), category (account|billing|bug|feature_request|other), source (email|web), status (closed|in_progress|open|resolved), resolved_at, requester_name, subject, requester_email, response_breached
      relations: assignee -> users, requester -> desk_requesters, messages -> desk_ticket_messages, queue -> desk_queues, ticket_type -> desk_ticket_types, csat_responses -> desk_csat

Pages:
  /board, /csat, /dashboard, /help-library, /macros, /performance, /queues, /reports, /requesters, /sla, /ticket-types, /tickets
  Each resource page is a list with search/filter plus create, edit and detail dialogs.

Workflows:
  desk_ Send resolved-ticket satisfaction follow-up - on desk_tickets change
  desk_ Escalate overdue urgent tickets - on a schedule

Seed data: about 128 rows in total, e.g. desk_tickets ~30, desk_requesters ~20, desk_csat ~15.
Keep every seeded value in English.

Build in this order: data model -> pages -> workflows -> roles/permissions -> seed data.
After each page, open it and confirm it renders and its create/edit dialogs work before moving on.`;
}

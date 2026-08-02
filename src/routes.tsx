import { defineAppRoutes } from "@nocobase/portal-sdk/routing";
import {
  BookOpenText,
  LayoutDashboard,
  SquareKanban,
  Tag,
  Ticket,
  Timer,
  UsersRound,
  BarChart3,
  Smile,
  Gauge,
  Layers3,
  Wand2,
} from "lucide-react";

import { AccessDenied } from "@/components/access-control/access-denied";
import { CanAccess } from "@/components/access-control/can-access";
import { BoardPage } from "@/pages/helpdesk/board";
import { DashboardPage } from "@/pages/helpdesk/dashboard";
import { HelpArticlesPage } from "@/pages/helpdesk/help-articles";
import { HelpArticleCreate, HelpArticleEdit } from "@/pages/helpdesk/help-article-form";
import { MacrosPage } from "@/pages/helpdesk/macros";
import { MacroCreate, MacroEdit } from "@/pages/helpdesk/macro-form";
import { QueueCreate, QueueEdit } from "@/pages/helpdesk/queue-form";
import { QueueShow } from "@/pages/helpdesk/queue-show";
import { SlaPage } from "@/pages/helpdesk/sla";
import { SlaPolicyCreate, SlaPolicyEdit } from "@/pages/helpdesk/sla-policy-form";
import { SlaPolicyShow } from "@/pages/helpdesk/sla-policy-show";
import { RequesterCreate, RequesterEdit } from "@/pages/helpdesk/requester-form";
import { TicketCreate } from "@/pages/helpdesk/tickets/ticket-create";
import { TicketEdit } from "@/pages/helpdesk/tickets/ticket-edit";
import { TicketList } from "@/pages/helpdesk/tickets/ticket-list";
import { TicketShow } from "@/pages/helpdesk/tickets/ticket-show";
import { TicketTypeList } from "@/pages/helpdesk/ticket-types/ticket-type-list";
import { TicketTypeCreate, TicketTypeEdit } from "@/pages/helpdesk/ticket-types/ticket-type-form";
import { TicketTypeShow } from "@/pages/helpdesk/ticket-types/ticket-type-show";
import { QueueWorkloadPage } from "@/pages/helpdesk/queue-workload";
import { CsatPage } from "@/pages/helpdesk/csat";
import { RequestersPage } from "@/pages/helpdesk/requesters";
import { RequesterShow } from "@/pages/helpdesk/requester-show";
import { AgentPerformancePage } from "@/pages/helpdesk/agent-performance";
import { ReportsPage } from "@/pages/helpdesk/reports";

// Set this to false when the application no longer needs the example routes
// contributed by installed Registry extensions. Providers, adapters, and the
// development showcase under /dev remain available.
export const registryRoutesEnabled = false;

// Add application-owned business routes here. Installed Registry extensions
// contribute their own route definitions through the same runtime. Add a
// resource entry when a route should also appear in navigation.
const ticketAccessDenied = <AccessDenied />;

const ticketDetail = () => (
  <CanAccess
    resource="desk_tickets"
    action="show"
    fallback={ticketAccessDenied}
  >
    <TicketShow />
  </CanAccess>
);

const ticketCreate = () => (
  <CanAccess
    resource="desk_tickets"
    action="create"
    fallback={ticketAccessDenied}
  >
    <TicketCreate />
  </CanAccess>
);

const ticketEdit = () => (
  <CanAccess
    resource="desk_tickets"
    action="edit"
    fallback={ticketAccessDenied}
  >
    <TicketEdit />
  </CanAccess>
);

// Cross-entity popups one level deeper than the ticket detail drawer: from
// `/tickets/show/:id`, clicking the linked queue, ticket type, requester, or
// SLA policy opens that record's own URL-addressable popup, stacked on top
// (same pattern as the hub portal's tasks module: route changes each level).
const ticketShowChildren = [
  {
    name: "desk_tickets.show.edit",
    path: "edit",
    element: ticketEdit(),
  },
  {
    name: "desk_tickets.show.queue",
    path: "queue/show/:queueId",
    element: <QueueShow idParam="queueId" />,
    children: [
      {
        name: "desk_tickets.show.queue.edit",
        path: "edit",
        element: <QueueEdit idParam="queueId" />,
      },
    ],
  },
  {
    name: "desk_tickets.show.ticketType",
    path: "ticket-type/show/:typeId",
    element: <TicketTypeShow idParam="typeId" />,
    children: [
      {
        name: "desk_tickets.show.ticketType.edit",
        path: "edit",
        element: <TicketTypeEdit idParam="typeId" />,
      },
    ],
  },
  {
    name: "desk_tickets.show.requester",
    path: "requester/show/:requesterId",
    element: <RequesterShow idParam="requesterId" />,
    children: [
      {
        name: "desk_tickets.show.requester.edit",
        path: "edit",
        element: <RequesterEdit idParam="requesterId" />,
      },
    ],
  },
  {
    name: "desk_tickets.show.slaPolicy",
    path: "sla-policy/show/:policyId",
    element: <SlaPolicyShow idParam="policyId" />,
    children: [
      {
        name: "desk_tickets.show.slaPolicy.edit",
        path: "edit",
        element: <SlaPolicyEdit idParam="policyId" />,
      },
    ],
  },
];

const queueShowChildren = [
  {
    name: "desk_queues.show.edit",
    path: "edit",
    element: <QueueEdit />,
  },
];

const ticketTypeShowChildren = [
  {
    name: "desk_ticket_types.show.edit",
    path: "edit",
    element: <TicketTypeEdit />,
  },
];

const slaPolicyShowChildren = [
  {
    name: "sla.policy.show.edit",
    path: "edit",
    element: <SlaPolicyEdit />,
  },
];

const requesterShowChildren = [
  {
    name: "desk_requesters.show.edit",
    path: "edit",
    element: <RequesterEdit />,
  },
];

export const appRoutes = defineAppRoutes([
  {
    name: "dashboard",
    path: "/dashboard",
    element: <DashboardPage />,
    resource: {
      meta: {
        label: "Dashboard",
        i18nKey: "navigation.dashboard",
        i18nOptions: { ns: "starter" },
        priority: 1,
        icon: <LayoutDashboard />,
      },
    },
    children: [
      {
        name: "dashboard.ticket",
        path: "tickets/:id",
        element: ticketDetail(),
        children: [
          {
            name: "dashboard.ticket.edit",
            path: "edit",
            element: ticketEdit(),
          },
        ],
      },
    ],
  },
  {
    name: "desk_tickets",
    path: "/tickets",
    element: (
      <CanAccess
        resource="desk_tickets"
        action="list"
        fallback={ticketAccessDenied}
      >
        <TicketList />
      </CanAccess>
    ),
    resource: {
      meta: {
        label: "Tickets",
        singularLabel: "Ticket",
        i18nKey: "tickets.resource.plural",
        i18nSingularKey: "tickets.resource.singular",
        i18nOptions: { ns: "starter" },
        priority: 2,
        icon: <Ticket />,
        description:
          "Customer issues logged from email and the web portal, with priority, assignment, and deadlines.",
        descriptionI18nKey: "tickets.description",
        canCreate: true,
        canDelete: true,
        acl: { type: "collection" },
      },
    },
    children: [
      {
        name: "desk_tickets.create",
        path: "create",
        resourceAction: "create",
        element: ticketCreate(),
      },
      {
        name: "desk_tickets.edit",
        path: "edit/:id",
        resourceAction: "edit",
        element: ticketEdit(),
      },
      {
        name: "desk_tickets.show",
        path: "show/:id",
        resourceAction: "show",
        element: ticketDetail(),
        children: ticketShowChildren,
      },
    ],
  },
  {
    name: "board",
    path: "/board",
    element: <BoardPage />,
    resource: {
      meta: {
        label: "Board",
        i18nKey: "navigation.board",
        i18nOptions: { ns: "starter" },
        priority: 3,
        icon: <SquareKanban />,
      },
    },
    children: [
      {
        name: "board.create",
        path: "create",
        element: ticketCreate(),
      },
      {
        name: "board.ticket",
        path: ":id",
        element: ticketDetail(),
        children: [
          {
            name: "board.ticket.edit",
            path: "edit",
            element: ticketEdit(),
          },
        ],
      },
    ],
  },
  {
    name: "sla",
    path: "/sla",
    element: <SlaPage />,
    resource: {
      meta: {
        label: "SLA",
        i18nKey: "navigation.sla",
        i18nOptions: { ns: "starter" },
        priority: 5,
        icon: <Timer />,
      },
    },
    children: [
      {
        name: "sla.ticket",
        path: ":id",
        element: ticketDetail(),
        children: [
          {
            name: "sla.ticket.edit",
            path: "edit",
            element: ticketEdit(),
          },
        ],
      },
      {
        name: "sla.policy.create",
        path: "policy/create",
        element: <SlaPolicyCreate />,
      },
      {
        name: "sla.policy.edit",
        path: "policy/edit/:id",
        element: <SlaPolicyEdit />,
      },
      {
        name: "sla.policy.show",
        path: "policy/show/:id",
        element: <SlaPolicyShow />,
        children: slaPolicyShowChildren,
      },
    ],
  },
  {
    name: "desk_help_articles",
    path: "/help-library",
    element: <HelpArticlesPage />,
    resource: {
      meta: {
        label: "Help library",
        i18nKey: "navigation.helpLibrary",
        i18nOptions: { ns: "starter" },
        priority: 7,
        icon: <BookOpenText />,
        description:
          "Reusable support guidance for consistent, customer-friendly replies.",
        descriptionI18nKey: "helpLibrary.description",
        acl: { type: "collection" },
      },
    },
    children: [
      {
        name: "desk_help_articles.create",
        path: "create",
        element: <HelpArticleCreate />,
      },
      {
        name: "desk_help_articles.edit",
        path: "edit/:id",
        element: <HelpArticleEdit />,
      },
    ],
  },
  {
    name: "desk_queues",
    path: "/queues",
    element: <CanAccess resource="desk_tickets" action="list" fallback={ticketAccessDenied}><QueueWorkloadPage /></CanAccess>,
    resource: { meta: { label: "Queue workload", i18nKey: "queues.title", i18nOptions: { ns: "starter" }, priority: 4, icon: <Layers3 />, acl: { type: "collection" } } },
    children: [
      { name: "desk_queues.ticket", path: ":id", element: ticketDetail(), children: [{ name: "desk_queues.ticket.edit", path: "edit", element: ticketEdit() }] },
      { name: "desk_queues.create", path: "create", element: <QueueCreate /> },
      { name: "desk_queues.edit", path: "edit/:id", element: <QueueEdit /> },
      { name: "desk_queues.show", path: "show/:id", element: <QueueShow />, children: queueShowChildren },
    ],
  },
  {
    name: "desk_ticket_types",
    path: "/ticket-types",
    element: <CanAccess resource="desk_ticket_types" action="list" fallback={ticketAccessDenied}><TicketTypeList /></CanAccess>,
    resource: { meta: { label: "Ticket types", i18nKey: "ticketTypes.title", i18nOptions: { ns: "starter" }, priority: 6, icon: <Tag />, description: "The categories of work customer requests are classified under.", descriptionI18nKey: "ticketTypes.description", acl: { type: "collection" } } },
    children: [
      { name: "desk_ticket_types.create", path: "create", element: <TicketTypeCreate /> },
      { name: "desk_ticket_types.edit", path: "edit/:id", element: <TicketTypeEdit /> },
      { name: "desk_ticket_types.show", path: "show/:id", element: <TicketTypeShow />, children: ticketTypeShowChildren },
    ],
  },
  {
    name: "desk_macros",
    path: "/macros",
    element: <CanAccess resource="desk_macros" action="list" fallback={ticketAccessDenied}><MacrosPage /></CanAccess>,
    resource: { meta: { label: "Macros", i18nKey: "macros.title", i18nOptions: { ns: "starter" }, priority: 11, icon: <Wand2 />, description: "Reusable reply snippets agents can insert into ticket conversations.", descriptionI18nKey: "macros.description", acl: { type: "collection" } } },
    children: [
      { name: "desk_macros.create", path: "create", element: <MacroCreate /> },
      { name: "desk_macros.edit", path: "edit/:id", element: <MacroEdit /> },
    ],
  },
  {
    name: "desk_requesters",
    path: "/requesters",
    element: <CanAccess resource="desk_requesters" action="list" fallback={ticketAccessDenied}><RequestersPage /></CanAccess>,
    resource: { meta: { label: "Requesters", i18nKey: "requesters.title", i18nOptions: { ns: "starter" }, priority: 8, icon: <UsersRound />, acl: { type: "collection" } } },
    children: [
      { name: "desk_requesters.create", path: "create", element: <RequesterCreate /> },
      { name: "desk_requesters.edit", path: "edit/:id", element: <RequesterEdit /> },
      { name: "desk_requesters.show", path: ":id", element: <RequesterShow />, children: requesterShowChildren },
    ],
  },
  {
    name: "desk_csat",
    path: "/csat",
    element: <CanAccess resource="desk_csat" action="list" fallback={ticketAccessDenied}><CsatPage /></CanAccess>,
    resource: { meta: { label: "Customer satisfaction", i18nKey: "csat.title", i18nOptions: { ns: "starter" }, priority: 9, icon: <Smile />, acl: { type: "collection" } } },
  },
  {
    name: "agent-performance",
    path: "/performance",
    element: <CanAccess resource="desk_tickets" action="list" fallback={ticketAccessDenied}><AgentPerformancePage /></CanAccess>,
    resource: { meta: { label: "Agent performance", i18nKey: "performance.title", i18nOptions: { ns: "starter" }, priority: 10, icon: <Gauge /> } },
  },
  {
    name: "reports",
    path: "/reports",
    element: <CanAccess resource="desk_tickets" action="list" fallback={ticketAccessDenied}><ReportsPage /></CanAccess>,
    resource: { meta: { label: "Reports", i18nKey: "reports.title", i18nOptions: { ns: "starter" }, priority: 12, icon: <BarChart3 /> } },
  },
]);

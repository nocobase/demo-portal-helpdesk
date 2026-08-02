import { defineAppRoutes } from "@nocobase/portal-sdk/routing";
import {
  BookOpenText,
  LayoutDashboard,
  SquareKanban,
  Ticket,
  Timer,
  UsersRound,
  BarChart3,
  Smile,
  Gauge,
  Layers3,
} from "lucide-react";

import { AccessDenied } from "@/components/access-control/access-denied";
import { CanAccess } from "@/components/access-control/can-access";
import { BoardPage } from "@/pages/helpdesk/board";
import { DashboardPage } from "@/pages/helpdesk/dashboard";
import { HelpArticlesPage } from "@/pages/helpdesk/help-articles";
import { SlaPage } from "@/pages/helpdesk/sla";
import { TicketCreate } from "@/pages/helpdesk/tickets/ticket-create";
import { TicketEdit } from "@/pages/helpdesk/tickets/ticket-edit";
import { TicketList } from "@/pages/helpdesk/tickets/ticket-list";
import { TicketShow } from "@/pages/helpdesk/tickets/ticket-show";
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
        children: [
          {
            name: "desk_tickets.show.edit",
            path: "edit",
            element: ticketEdit(),
          },
        ],
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
  },
  {
    name: "desk_queues",
    path: "/queues",
    element: <CanAccess resource="desk_tickets" action="list" fallback={ticketAccessDenied}><QueueWorkloadPage /></CanAccess>,
    resource: { meta: { label: "Queue workload", i18nKey: "queues.title", i18nOptions: { ns: "starter" }, priority: 4, icon: <Layers3 />, acl: { type: "collection" } } },
    children: [{ name: "desk_queues.ticket", path: ":id", element: ticketDetail(), children: [{ name: "desk_queues.ticket.edit", path: "edit", element: ticketEdit() }] }],
  },
  {
    name: "desk_requesters",
    path: "/requesters",
    element: <CanAccess resource="desk_requesters" action="list" fallback={ticketAccessDenied}><RequestersPage /></CanAccess>,
    resource: { meta: { label: "Requesters", i18nKey: "requesters.title", i18nOptions: { ns: "starter" }, priority: 6, icon: <UsersRound />, acl: { type: "collection" } } },
    children: [{ name: "desk_requesters.show", path: ":id", element: <RequesterShow />, children: [{ name: "desk_requesters.ticket", path: "tickets/:id", element: ticketDetail(), children: [{ name: "desk_requesters.ticket.edit", path: "edit", element: ticketEdit() }] }] }],
  },
  {
    name: "desk_csat",
    path: "/csat",
    element: <CanAccess resource="desk_csat" action="list" fallback={ticketAccessDenied}><CsatPage /></CanAccess>,
    resource: { meta: { label: "Customer satisfaction", i18nKey: "csat.title", i18nOptions: { ns: "starter" }, priority: 8, icon: <Smile />, acl: { type: "collection" } } },
  },
  {
    name: "agent-performance",
    path: "/performance",
    element: <CanAccess resource="desk_tickets" action="list" fallback={ticketAccessDenied}><AgentPerformancePage /></CanAccess>,
    resource: { meta: { label: "Agent performance", i18nKey: "performance.title", i18nOptions: { ns: "starter" }, priority: 9, icon: <Gauge /> } },
  },
  {
    name: "reports",
    path: "/reports",
    element: <CanAccess resource="desk_tickets" action="list" fallback={ticketAccessDenied}><ReportsPage /></CanAccess>,
    resource: { meta: { label: "Reports", i18nKey: "reports.title", i18nOptions: { ns: "starter" }, priority: 10, icon: <BarChart3 /> } },
  },
]);

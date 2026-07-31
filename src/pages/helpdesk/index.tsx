import type { ResourceProps } from "@refinedev/core";
import { BookOpenText, LayoutDashboard, SquareKanban, Ticket, Timer } from "lucide-react";
import type { ReactElement } from "react";
import { Route } from "react-router";

import { CanAccess } from "@/components/access-control/can-access";
import { AccessDenied } from "@/components/access-control/access-denied";
import { BoardPage } from "./board";
import { DashboardPage } from "./dashboard";
import { SlaPage } from "./sla";
import { HelpArticlesPage } from "./help-articles";
import { TicketsLayout } from "./tickets/tickets-layout";
import { TicketCreate } from "./tickets/ticket-create";
import { TicketEdit } from "./tickets/ticket-edit";
import { TicketShow } from "./tickets/ticket-show";

export const helpdeskResources: ResourceProps[] = [
  {
    name: "dashboard",
    list: "/dashboard",
    meta: {
      label: "Dashboard",
      priority: 1,
      icon: <LayoutDashboard />,
    },
  },
  {
    name: "desk_tickets",
    list: "/tickets",
    create: "/tickets/create",
    edit: "/tickets/edit",
    show: "/tickets/show",
    meta: {
      label: "Tickets",
      priority: 2,
      icon: <Ticket />,
      description:
        "Customer issues logged from email and the web portal, with priority, assignment, and deadlines.",
      canCreate: true,
      canDelete: true,
      acl: { type: "collection" },
    },
  },
  {
    name: "board",
    list: "/board",
    meta: {
      label: "Board",
      priority: 3,
      icon: <SquareKanban />,
    },
  },
  {
    name: "sla",
    list: "/sla",
    meta: {
      label: "SLA",
      priority: 4,
      icon: <Timer />,
    },
  },
  {
    name: "desk_help_articles",
    list: "/help-library",
    meta: {
      label: "Help library",
      priority: 5,
      icon: <BookOpenText />,
      description: "Reusable support guidance for consistent, customer-friendly replies.",
      acl: { type: "collection" },
    },
  },
];

function CanShowTicket({
  closeTo,
}: {
  closeTo?: string;
}) {
  return (
    <CanAccess
      resource="desk_tickets"
      action="show"
      fallback={<AccessDenied />}
    >
      <TicketShow closeTo={closeTo} />
    </CanAccess>
  );
}

export const helpdeskRouteElements: ReactElement[] = [
  <Route key="/dashboard" path="/dashboard" element={<DashboardPage />} />,
  <Route key="/tickets" path="/tickets" element={<TicketsLayout />}>
    <Route
      path="create"
      element={
        <CanAccess
          resource="desk_tickets"
          action="create"
          fallback={<AccessDenied />}
        >
          <TicketCreate />
        </CanAccess>
      }
    />
    <Route
      path="edit/:id"
      element={
        <CanAccess
          resource="desk_tickets"
          action="edit"
          fallback={<AccessDenied />}
        >
          <TicketEdit />
        </CanAccess>
      }
    />
    <Route
      path="show/:id"
      element={<CanShowTicket />}
    />
  </Route>,
  <Route key="/board" path="/board" element={<BoardPage />}>
    <Route path=":id" element={<CanShowTicket closeTo="/board" />} />
  </Route>,
  <Route key="/sla" path="/sla" element={<SlaPage />}>
    <Route path=":id" element={<CanShowTicket closeTo="/sla" />} />
  </Route>,
  <Route key="/help-library" path="/help-library" element={<HelpArticlesPage />} />,
];

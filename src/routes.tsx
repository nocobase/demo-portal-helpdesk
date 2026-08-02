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

import { withHelpdeskAccess } from "@/pages/helpdesk/routes/access-route";

// Set this to false when the application no longer needs the example routes
// contributed by installed Registry extensions. Providers, adapters, and the
// development showcase under /dev remain available.
export const registryRoutesEnabled = false;

// Add application-owned business routes here. Installed Registry extensions
// contribute their own route definitions through the same runtime. Add a
// resource entry when a route should also appear in navigation.
const ticketDetail = () =>
  import("@/pages/helpdesk/routes/ticket-show-route");
const ticketCreate = () =>
  import("@/pages/helpdesk/routes/ticket-create-route");
const ticketEdit = () =>
  import("@/pages/helpdesk/routes/ticket-edit-route");

const queueCreate = withHelpdeskAccess(
  () =>
    import("@/pages/helpdesk/queue-form").then(({ QueueCreate }) => ({
      default: QueueCreate,
    })),
  "desk_queues",
  "create"
);
const queueEdit = (idParam = "id") =>
  withHelpdeskAccess(
    async () => {
      const { QueueEdit } = await import("@/pages/helpdesk/queue-form");
      return { default: () => <QueueEdit idParam={idParam} /> };
    },
    "desk_queues",
    "edit"
  );
const queueShow = (idParam = "id") =>
  withHelpdeskAccess(
    async () => {
      const { QueueShow } = await import("@/pages/helpdesk/queue-show");
      return { default: () => <QueueShow idParam={idParam} /> };
    },
    "desk_queues",
    "show"
  );

const ticketTypeCreate = withHelpdeskAccess(
  () =>
    import("@/pages/helpdesk/ticket-types/ticket-type-form").then(
      ({ TicketTypeCreate }) => ({ default: TicketTypeCreate })
    ),
  "desk_ticket_types",
  "create"
);
const ticketTypeEdit = (idParam = "id") =>
  withHelpdeskAccess(
    async () => {
      const { TicketTypeEdit } = await import(
        "@/pages/helpdesk/ticket-types/ticket-type-form"
      );
      return { default: () => <TicketTypeEdit idParam={idParam} /> };
    },
    "desk_ticket_types",
    "edit"
  );
const ticketTypeShow = (idParam = "id") =>
  withHelpdeskAccess(
    async () => {
      const { TicketTypeShow } = await import(
        "@/pages/helpdesk/ticket-types/ticket-type-show"
      );
      return { default: () => <TicketTypeShow idParam={idParam} /> };
    },
    "desk_ticket_types",
    "show"
  );

const requesterCreate = withHelpdeskAccess(
  () =>
    import("@/pages/helpdesk/requester-form").then(({ RequesterCreate }) => ({
      default: RequesterCreate,
    })),
  "desk_requesters",
  "create"
);
const requesterEdit = (idParam = "id") =>
  withHelpdeskAccess(
    async () => {
      const { RequesterEdit } = await import("@/pages/helpdesk/requester-form");
      return { default: () => <RequesterEdit idParam={idParam} /> };
    },
    "desk_requesters",
    "edit"
  );
const requesterShow = (idParam = "id") =>
  withHelpdeskAccess(
    async () => {
      const { RequesterShow } = await import("@/pages/helpdesk/requester-show");
      return { default: () => <RequesterShow idParam={idParam} /> };
    },
    "desk_requesters",
    "show"
  );

const slaPolicyCreate = withHelpdeskAccess(
  () =>
    import("@/pages/helpdesk/sla-policy-form").then(({ SlaPolicyCreate }) => ({
      default: SlaPolicyCreate,
    })),
  "desk_sla_policies",
  "create"
);
const slaPolicyEdit = (idParam = "id") =>
  withHelpdeskAccess(
    async () => {
      const { SlaPolicyEdit } = await import(
        "@/pages/helpdesk/sla-policy-form"
      );
      return { default: () => <SlaPolicyEdit idParam={idParam} /> };
    },
    "desk_sla_policies",
    "edit"
  );
const slaPolicyShow = (idParam = "id") =>
  withHelpdeskAccess(
    async () => {
      const { SlaPolicyShow } = await import(
        "@/pages/helpdesk/sla-policy-show"
      );
      return { default: () => <SlaPolicyShow idParam={idParam} /> };
    },
    "desk_sla_policies",
    "show"
  );

// Cross-entity popups one level deeper than the ticket detail drawer: from
// `/tickets/show/:id`, clicking the linked queue, ticket type, requester, or
// SLA policy opens that record's own URL-addressable popup, stacked on top
// (same pattern as the hub portal's tasks module: route changes each level).
const ticketShowChildren = [
  {
    name: "desk_tickets.show.edit",
    path: "edit",
    lazy: ticketEdit,
  },
  {
    name: "desk_tickets.show.queue",
    path: "queue/show/:queueId",
    lazy: queueShow("queueId"),
    children: [
      {
        name: "desk_tickets.show.queue.edit",
        path: "edit",
        lazy: queueEdit("queueId"),
      },
    ],
  },
  {
    name: "desk_tickets.show.ticketType",
    path: "ticket-type/show/:typeId",
    lazy: ticketTypeShow("typeId"),
    children: [
      {
        name: "desk_tickets.show.ticketType.edit",
        path: "edit",
        lazy: ticketTypeEdit("typeId"),
      },
    ],
  },
  {
    name: "desk_tickets.show.requester",
    path: "requester/show/:requesterId",
    lazy: requesterShow("requesterId"),
    children: [
      {
        name: "desk_tickets.show.requester.edit",
        path: "edit",
        lazy: requesterEdit("requesterId"),
      },
    ],
  },
  {
    name: "desk_tickets.show.slaPolicy",
    path: "sla-policy/show/:policyId",
    lazy: slaPolicyShow("policyId"),
    children: [
      {
        name: "desk_tickets.show.slaPolicy.edit",
        path: "edit",
        lazy: slaPolicyEdit("policyId"),
      },
    ],
  },
];

const queueShowChildren = [
  {
    name: "desk_queues.show.edit",
    path: "edit",
    lazy: queueEdit(),
  },
];

const ticketTypeShowChildren = [
  {
    name: "desk_ticket_types.show.edit",
    path: "edit",
    lazy: ticketTypeEdit(),
  },
];

const slaPolicyShowChildren = [
  {
    name: "sla.policy.show.edit",
    path: "edit",
    lazy: slaPolicyEdit(),
  },
];

const requesterShowChildren = [
  {
    name: "desk_requesters.show.edit",
    path: "edit",
    lazy: requesterEdit(),
  },
  {
    name: "desk_requesters.ticket",
    path: "tickets/:id",
    lazy: ticketDetail,
    children: [
      {
        name: "desk_requesters.ticket.edit",
        path: "edit",
        lazy: ticketEdit,
      },
    ],
  },
];

export const appRoutes = defineAppRoutes([
  {
    name: "dashboard",
    path: "/dashboard",
    lazy: () =>
      import("@/pages/helpdesk/dashboard").then((module) => ({
        default: module.DashboardPage,
      })),
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
        lazy: ticketDetail,
        children: [
          {
            name: "dashboard.ticket.edit",
            path: "edit",
            lazy: ticketEdit,
          },
        ],
      },
    ],
  },
  {
    name: "desk_tickets",
    path: "/tickets",
    lazy: () => import("@/pages/helpdesk/routes/ticket-list-route"),
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
        lazy: ticketCreate,
      },
      {
        name: "desk_tickets.edit",
        path: "edit/:id",
        resourceAction: "edit",
        lazy: ticketEdit,
      },
      {
        name: "desk_tickets.show",
        path: "show/:id",
        resourceAction: "show",
        lazy: ticketDetail,
        children: ticketShowChildren,
      },
    ],
  },
  {
    name: "board",
    path: "/board",
    lazy: () =>
      import("@/pages/helpdesk/board").then((module) => ({
        default: module.BoardPage,
      })),
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
        lazy: ticketCreate,
      },
      {
        name: "board.ticket",
        path: ":id",
        lazy: ticketDetail,
        children: [
          {
            name: "board.ticket.edit",
            path: "edit",
            lazy: ticketEdit,
          },
        ],
      },
    ],
  },
  {
    name: "sla",
    path: "/sla",
    lazy: () =>
      import("@/pages/helpdesk/sla").then((module) => ({
        default: module.SlaPage,
      })),
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
        lazy: ticketDetail,
        children: [
          {
            name: "sla.ticket.edit",
            path: "edit",
            lazy: ticketEdit,
          },
        ],
      },
      {
        name: "sla.policy.create",
        path: "policy/create",
        lazy: slaPolicyCreate,
      },
      {
        name: "sla.policy.edit",
        path: "policy/edit/:id",
        lazy: slaPolicyEdit(),
      },
      {
        name: "sla.policy.show",
        path: "policy/show/:id",
        lazy: slaPolicyShow(),
        children: slaPolicyShowChildren,
      },
    ],
  },
  {
    name: "desk_help_articles",
    path: "/help-library",
    lazy: () =>
      import("@/pages/helpdesk/help-articles").then((module) => ({
        default: module.HelpArticlesPage,
      })),
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
        lazy: withHelpdeskAccess(
          () =>
            import("@/pages/helpdesk/help-article-form").then(
              ({ HelpArticleCreate }) => ({ default: HelpArticleCreate })
            ),
          "desk_help_articles",
          "create"
        ),
      },
      {
        name: "desk_help_articles.edit",
        path: "edit/:id",
        lazy: withHelpdeskAccess(
          () =>
            import("@/pages/helpdesk/help-article-form").then(
              ({ HelpArticleEdit }) => ({ default: HelpArticleEdit })
            ),
          "desk_help_articles",
          "edit"
        ),
      },
    ],
  },
  {
    name: "desk_queues",
    path: "/queues",
    lazy: () => import("@/pages/helpdesk/routes/queue-workload-route"),
    resource: { meta: { label: "Queue workload", i18nKey: "queues.title", i18nOptions: { ns: "starter" }, priority: 4, icon: <Layers3 />, acl: { type: "collection" } } },
    children: [
      {
        name: "desk_queues.ticket",
        path: ":id",
        lazy: ticketDetail,
        children: [
          { name: "desk_queues.ticket.edit", path: "edit", lazy: ticketEdit },
        ],
      },
      { name: "desk_queues.create", path: "create", lazy: queueCreate },
      { name: "desk_queues.edit", path: "edit/:id", lazy: queueEdit() },
      {
        name: "desk_queues.show",
        path: "show/:id",
        lazy: queueShow(),
        children: queueShowChildren,
      },
    ],
  },
  {
    name: "desk_ticket_types",
    path: "/ticket-types",
    lazy: withHelpdeskAccess(
      () =>
        import("@/pages/helpdesk/ticket-types/ticket-type-list").then(
          ({ TicketTypeList }) => ({ default: TicketTypeList })
        ),
      "desk_ticket_types",
      "list"
    ),
    resource: { meta: { label: "Ticket types", i18nKey: "ticketTypes.title", i18nOptions: { ns: "starter" }, priority: 6, icon: <Tag />, description: "The categories of work customer requests are classified under.", descriptionI18nKey: "ticketTypes.description", acl: { type: "collection" } } },
    children: [
      { name: "desk_ticket_types.create", path: "create", lazy: ticketTypeCreate },
      { name: "desk_ticket_types.edit", path: "edit/:id", lazy: ticketTypeEdit() },
      {
        name: "desk_ticket_types.show",
        path: "show/:id",
        lazy: ticketTypeShow(),
        children: ticketTypeShowChildren,
      },
    ],
  },
  {
    name: "desk_macros",
    path: "/macros",
    lazy: withHelpdeskAccess(
      () =>
        import("@/pages/helpdesk/macros").then(({ MacrosPage }) => ({
          default: MacrosPage,
        })),
      "desk_macros",
      "list"
    ),
    resource: { meta: { label: "Macros", i18nKey: "macros.title", i18nOptions: { ns: "starter" }, priority: 11, icon: <Wand2 />, description: "Reusable reply snippets agents can insert into ticket conversations.", descriptionI18nKey: "macros.description", acl: { type: "collection" } } },
    children: [
      {
        name: "desk_macros.create",
        path: "create",
        lazy: withHelpdeskAccess(
          () =>
            import("@/pages/helpdesk/macro-form").then(({ MacroCreate }) => ({
              default: MacroCreate,
            })),
          "desk_macros",
          "create"
        ),
      },
      {
        name: "desk_macros.edit",
        path: "edit/:id",
        lazy: withHelpdeskAccess(
          () =>
            import("@/pages/helpdesk/macro-form").then(({ MacroEdit }) => ({
              default: MacroEdit,
            })),
          "desk_macros",
          "edit"
        ),
      },
    ],
  },
  {
    name: "desk_requesters",
    path: "/requesters",
    lazy: () => import("@/pages/helpdesk/routes/requesters-route"),
    resource: { meta: { label: "Requesters", i18nKey: "requesters.title", i18nOptions: { ns: "starter" }, priority: 8, icon: <UsersRound />, acl: { type: "collection" } } },
    children: [
      { name: "desk_requesters.create", path: "create", lazy: requesterCreate },
      { name: "desk_requesters.edit", path: "edit/:id", lazy: requesterEdit() },
      {
        name: "desk_requesters.show",
        path: ":id",
        lazy: requesterShow(),
        children: requesterShowChildren,
      },
    ],
  },
  {
    name: "desk_csat",
    path: "/csat",
    lazy: () => import("@/pages/helpdesk/routes/csat-route"),
    resource: { meta: { label: "Customer satisfaction", i18nKey: "csat.title", i18nOptions: { ns: "starter" }, priority: 9, icon: <Smile />, acl: { type: "collection" } } },
  },
  {
    name: "agent-performance",
    path: "/performance",
    lazy: () => import("@/pages/helpdesk/routes/agent-performance-route"),
    resource: { meta: { label: "Agent performance", i18nKey: "performance.title", i18nOptions: { ns: "starter" }, priority: 10, icon: <Gauge /> } },
  },
  {
    name: "reports",
    path: "/reports",
    lazy: () => import("@/pages/helpdesk/routes/reports-route"),
    resource: { meta: { label: "Reports", i18nKey: "reports.title", i18nOptions: { ns: "starter" }, priority: 12, icon: <BarChart3 /> } },
  },
]);

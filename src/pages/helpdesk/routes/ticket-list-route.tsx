import { TicketList } from "@/pages/helpdesk/tickets/ticket-list";
import { HelpdeskAccessRoute } from "./access-route";

export default function TicketListRoute() {
  return (
    <HelpdeskAccessRoute resource="desk_tickets" action="list">
      <TicketList />
    </HelpdeskAccessRoute>
  );
}

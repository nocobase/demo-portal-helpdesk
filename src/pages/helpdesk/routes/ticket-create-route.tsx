import { TicketCreate } from "@/pages/helpdesk/tickets/ticket-create";
import { HelpdeskAccessRoute } from "./access-route";

export default function TicketCreateRoute() {
  return (
    <HelpdeskAccessRoute resource="desk_tickets" action="create">
      <TicketCreate />
    </HelpdeskAccessRoute>
  );
}

import { TicketEdit } from "@/pages/helpdesk/tickets/ticket-edit";
import { HelpdeskAccessRoute } from "./access-route";

export default function TicketEditRoute() {
  return (
    <HelpdeskAccessRoute resource="desk_tickets" action="edit">
      <TicketEdit />
    </HelpdeskAccessRoute>
  );
}

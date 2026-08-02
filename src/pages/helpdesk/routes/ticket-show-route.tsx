import { TicketShow } from "@/pages/helpdesk/tickets/ticket-show";
import { HelpdeskAccessRoute } from "./access-route";

export default function TicketShowRoute() {
  return (
    <HelpdeskAccessRoute resource="desk_tickets" action="show">
      <TicketShow />
    </HelpdeskAccessRoute>
  );
}

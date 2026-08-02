import { QueueWorkloadPage } from "@/pages/helpdesk/queue-workload";
import { HelpdeskAccessRoute } from "./access-route";

export default function QueueWorkloadRoute() {
  return (
    <HelpdeskAccessRoute resource="desk_tickets" action="list">
      <QueueWorkloadPage />
    </HelpdeskAccessRoute>
  );
}

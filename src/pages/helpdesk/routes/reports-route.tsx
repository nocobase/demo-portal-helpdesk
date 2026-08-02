import { ReportsPage } from "@/pages/helpdesk/reports";
import { HelpdeskAccessRoute } from "./access-route";

export default function ReportsRoute() {
  return (
    <HelpdeskAccessRoute resource="desk_tickets" action="list">
      <ReportsPage />
    </HelpdeskAccessRoute>
  );
}

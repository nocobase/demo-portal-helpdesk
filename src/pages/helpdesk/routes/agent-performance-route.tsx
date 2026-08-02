import { AgentPerformancePage } from "@/pages/helpdesk/agent-performance";
import { HelpdeskAccessRoute } from "./access-route";

export default function AgentPerformanceRoute() {
  return (
    <HelpdeskAccessRoute resource="desk_tickets" action="list">
      <AgentPerformancePage />
    </HelpdeskAccessRoute>
  );
}

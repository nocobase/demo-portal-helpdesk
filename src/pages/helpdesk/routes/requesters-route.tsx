import { RequestersPage } from "@/pages/helpdesk/requesters";
import { HelpdeskAccessRoute } from "./access-route";

export default function RequestersRoute() {
  return (
    <HelpdeskAccessRoute resource="desk_requesters" action="list">
      <RequestersPage />
    </HelpdeskAccessRoute>
  );
}

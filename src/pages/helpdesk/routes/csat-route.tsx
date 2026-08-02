import { CsatPage } from "@/pages/helpdesk/csat";
import { HelpdeskAccessRoute } from "./access-route";

export default function CsatRoute() {
  return (
    <HelpdeskAccessRoute resource="desk_csat" action="list">
      <CsatPage />
    </HelpdeskAccessRoute>
  );
}

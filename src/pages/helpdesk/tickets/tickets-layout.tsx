import { CanAccess } from "@/components/access-control/can-access";
import { Outlet } from "react-router";

import { AccessDenied } from "@/components/access-control/access-denied";
import { TicketList } from "./ticket-list";

export function TicketsLayout() {
  return (
    <>
      <CanAccess resource="desk_tickets" action="list" fallback={<AccessDenied />}>
        <TicketList />
      </CanAccess>
      <Outlet />
    </>
  );
}

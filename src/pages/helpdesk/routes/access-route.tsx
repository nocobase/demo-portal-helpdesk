import type { ComponentType } from "react";

import type { CanAccessProps } from "@/components/access-control/can-access";
import { AccessDenied } from "@/components/access-control/access-denied";
import { CanAccess } from "@/components/access-control/can-access";

type LazyRouteModule = { default: ComponentType };
type LazyRouteLoader = () => Promise<LazyRouteModule>;

export function HelpdeskAccessRoute({ children, ...request }: CanAccessProps) {
  return (
    <CanAccess {...request} fallback={<AccessDenied />}>
      {children}
    </CanAccess>
  );
}

export function withHelpdeskAccess(
  load: LazyRouteLoader,
  resource: string,
  action: string
): LazyRouteLoader {
  return async () => {
    const { default: Page } = await load();

    function ProtectedRoute() {
      return (
        <HelpdeskAccessRoute resource={resource} action={action}>
          <Page />
        </HelpdeskAccessRoute>
      );
    }

    return { default: ProtectedRoute };
  };
}

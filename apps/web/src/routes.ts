import { RoutePath } from "./web-constants";

export const AppRouteKind = {
  LOGIN: "login",
  LOBBY: "lobby",
  HISTORY: "history",
  TABLE: "table",
  NOT_FOUND: "not-found",
} as const;

export type AppRoute =
  | { kind: typeof AppRouteKind.LOGIN }
  | { kind: typeof AppRouteKind.LOBBY }
  | { kind: typeof AppRouteKind.HISTORY }
  | { kind: typeof AppRouteKind.TABLE; tableId: string }
  | { kind: typeof AppRouteKind.NOT_FOUND; pathname: string };

const normalizePathname = (pathname: string) => {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
};

const tablePathPattern = new RegExp(`^${RoutePath.TABLES_ROOT}/([^/]+)$`);

export const resolveRoute = (pathname: string): AppRoute => {
  const normalizedPathname = normalizePathname(pathname);

  if (
    normalizedPathname === RoutePath.ROOT ||
    normalizedPathname === RoutePath.LOGIN
  ) {
    return { kind: AppRouteKind.LOGIN };
  }

  if (normalizedPathname === RoutePath.LOBBY) {
    return { kind: AppRouteKind.LOBBY };
  }

  if (normalizedPathname === RoutePath.HISTORY) {
    return { kind: AppRouteKind.HISTORY };
  }

  const tableMatch = tablePathPattern.exec(normalizedPathname);
  if (tableMatch) {
    const tableId = tableMatch.at(1);
    if (tableId) {
      return { kind: AppRouteKind.TABLE, tableId };
    }
  }

  return { kind: AppRouteKind.NOT_FOUND, pathname: normalizedPathname };
};

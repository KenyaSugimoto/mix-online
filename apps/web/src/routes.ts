export const AppRouteKind = {
  LOGIN: "login",
  LOBBY: "lobby",
  TABLE: "table",
  NOT_FOUND: "not-found",
} as const;

export type AppRoute =
  | { kind: typeof AppRouteKind.LOGIN }
  | { kind: typeof AppRouteKind.LOBBY }
  | { kind: typeof AppRouteKind.TABLE; tableId: string }
  | { kind: typeof AppRouteKind.NOT_FOUND; pathname: string };

const normalizePathname = (pathname: string) => {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
};

export const resolveRoute = (pathname: string): AppRoute => {
  const normalizedPathname = normalizePathname(pathname);

  if (normalizedPathname === "/" || normalizedPathname === "/login") {
    return { kind: AppRouteKind.LOGIN };
  }

  if (normalizedPathname === "/lobby") {
    return { kind: AppRouteKind.LOBBY };
  }

  const tableMatch = /^\/tables\/([^/]+)$/.exec(normalizedPathname);
  if (tableMatch) {
    const tableId = tableMatch.at(1);
    if (tableId) {
      return { kind: AppRouteKind.TABLE, tableId };
    }
  }

  return { kind: AppRouteKind.NOT_FOUND, pathname: normalizedPathname };
};

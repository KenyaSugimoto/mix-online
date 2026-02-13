export type AppRoute =
  | { kind: "login" }
  | { kind: "lobby" }
  | { kind: "table"; tableId: string }
  | { kind: "not-found"; pathname: string };

const normalizePathname = (pathname: string) => {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
};

export const resolveRoute = (pathname: string): AppRoute => {
  const normalizedPathname = normalizePathname(pathname);

  if (normalizedPathname === "/" || normalizedPathname === "/login") {
    return { kind: "login" };
  }

  if (normalizedPathname === "/lobby") {
    return { kind: "lobby" };
  }

  const tableMatch = /^\/tables\/([^/]+)$/.exec(normalizedPathname);
  if (tableMatch) {
    const tableId = tableMatch.at(1);
    if (tableId) {
      return { kind: "table", tableId };
    }
  }

  return { kind: "not-found", pathname: normalizedPathname };
};

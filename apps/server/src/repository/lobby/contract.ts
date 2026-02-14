import type { LobbyTableRecord } from "../../lobby-table";

export interface LobbyTableRepository {
  listTables(): Promise<LobbyTableRecord[]>;
}

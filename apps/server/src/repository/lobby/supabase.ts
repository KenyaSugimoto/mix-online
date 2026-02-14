import { SeatStatus } from "@mix-online/shared";
import type { LobbyTableRecord } from "../../lobby-table";
import { isRecord } from "../shared/guards";
import type { LobbyTableRepository } from "./contract";

const REST_TABLES_PATH = "/rest/v1/tables";
const REST_TABLE_SEATS_PATH = "/rest/v1/table_seats";

type SupabaseLobbyTableRepositoryOptions = {
  supabaseUrl: string;
  serviceRoleKey: string;
  fetchImpl?: typeof fetch;
};

type SupabaseTableRow = {
  id: string;
  name: string;
  small_bet: number;
  big_bet: number;
  ante: number;
  bring_in: number;
  max_players: number;
  mix_index: number;
};

type SupabaseTableSeatRow = {
  table_id: string;
  user_id: string | null;
  status: string;
};

const toError = async (params: {
  response: Response;
  step: string;
}): Promise<Error> => {
  const responseBody = await params.response.text();
  return new Error(
    `${params.step} failed: status=${params.response.status}, body=${responseBody}`,
  );
};

const parseTableRows = (payload: unknown): SupabaseTableRow[] => {
  if (!Array.isArray(payload)) {
    throw new Error("Supabase tables response is not an array.");
  }

  return payload.map((item) => {
    if (!isRecord(item)) {
      throw new Error("Supabase tables response row is invalid.");
    }

    const id = item.id;
    const name = item.name;
    const smallBet = item.small_bet;
    const bigBet = item.big_bet;
    const ante = item.ante;
    const bringIn = item.bring_in;
    const maxPlayers = item.max_players;
    const mixIndex = item.mix_index;

    if (typeof id !== "string" || id.length === 0) {
      throw new Error("Supabase tables row does not include id.");
    }
    if (typeof name !== "string") {
      throw new Error("Supabase tables row does not include name.");
    }
    if (
      typeof smallBet !== "number" ||
      typeof bigBet !== "number" ||
      typeof ante !== "number" ||
      typeof bringIn !== "number" ||
      typeof maxPlayers !== "number" ||
      typeof mixIndex !== "number"
    ) {
      throw new Error("Supabase tables row has invalid numeric fields.");
    }

    return {
      id,
      name,
      small_bet: smallBet,
      big_bet: bigBet,
      ante,
      bring_in: bringIn,
      max_players: maxPlayers,
      mix_index: mixIndex,
    };
  });
};

const parseTableSeatRows = (payload: unknown): SupabaseTableSeatRow[] => {
  if (!Array.isArray(payload)) {
    throw new Error("Supabase table_seats response is not an array.");
  }

  return payload.map((item) => {
    if (!isRecord(item)) {
      throw new Error("Supabase table_seats response row is invalid.");
    }

    const tableId = item.table_id;
    const userId = item.user_id;
    const status = item.status;

    if (typeof tableId !== "string" || tableId.length === 0) {
      throw new Error("Supabase table_seats row does not include table_id.");
    }
    if (userId !== null && typeof userId !== "string") {
      throw new Error("Supabase table_seats row has invalid user_id.");
    }
    if (typeof status !== "string") {
      throw new Error("Supabase table_seats row has invalid status.");
    }

    return {
      table_id: tableId,
      user_id: userId,
      status,
    };
  });
};

export const createSupabaseLobbyTableRepository = (
  options: SupabaseLobbyTableRepositoryOptions,
): LobbyTableRepository => {
  const fetchImpl = options.fetchImpl ?? fetch;
  const authorizationHeaderValue = `Bearer ${options.serviceRoleKey}`;

  return {
    async listTables() {
      const tablesUrl = new URL(REST_TABLES_PATH, options.supabaseUrl);
      tablesUrl.searchParams.set(
        "select",
        "id,name,small_bet,big_bet,ante,bring_in,max_players,mix_index",
      );
      tablesUrl.searchParams.set("order", "id.asc");

      const tablesResponse = await fetchImpl(tablesUrl, {
        method: "GET",
        headers: {
          apikey: options.serviceRoleKey,
          Authorization: authorizationHeaderValue,
        },
      });

      if (!tablesResponse.ok) {
        throw await toError({
          response: tablesResponse,
          step: "Supabase tables select",
        });
      }

      const tableRows = parseTableRows(await tablesResponse.json());

      const tableSeatsUrl = new URL(REST_TABLE_SEATS_PATH, options.supabaseUrl);
      tableSeatsUrl.searchParams.set("select", "table_id,user_id,status");

      const tableSeatsResponse = await fetchImpl(tableSeatsUrl, {
        method: "GET",
        headers: {
          apikey: options.serviceRoleKey,
          Authorization: authorizationHeaderValue,
        },
      });

      if (!tableSeatsResponse.ok) {
        throw await toError({
          response: tableSeatsResponse,
          step: "Supabase table_seats select",
        });
      }

      const tableSeatRows = parseTableSeatRows(await tableSeatsResponse.json());
      const playersCountByTableId = new Map<string, number>();

      for (const row of tableSeatRows) {
        if (row.user_id === null || row.status === SeatStatus.EMPTY) {
          continue;
        }
        playersCountByTableId.set(
          row.table_id,
          (playersCountByTableId.get(row.table_id) ?? 0) + 1,
        );
      }

      return tableRows.map((row): LobbyTableRecord => {
        return {
          tableId: row.id,
          tableName: row.name,
          smallBet: row.small_bet,
          bigBet: row.big_bet,
          ante: row.ante,
          bringIn: row.bring_in,
          players: playersCountByTableId.get(row.id) ?? 0,
          maxPlayers: row.max_players,
          mixIndex: row.mix_index,
        };
      });
    },
  };
};

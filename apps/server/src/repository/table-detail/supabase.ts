import { GameType, HandStatus, SeatStatus, Street } from "@mix-online/shared";
import type {
  CurrentHandSummaryRecord,
  TableDetailRecord,
  TableSeatRecord,
} from "../../table-detail";
import {
  isRecord,
  isStreet,
  parseHandStatus,
  parseSeatStatus,
  parseTableStatus,
} from "../shared/guards";
import type { TableDetailRepository } from "./contract";

const REST_TABLES_PATH = "/rest/v1/tables";
const REST_TABLE_SEATS_PATH = "/rest/v1/table_seats";
const REST_HANDS_PATH = "/rest/v1/hands";
const REST_HAND_EVENTS_PATH = "/rest/v1/hand_events";
const REST_TABLE_SNAPSHOTS_PATH = "/rest/v1/table_snapshots";
const REST_USERS_PATH = "/rest/v1/users";

type SupabaseTableDetailRepositoryOptions = {
  supabaseUrl: string;
  serviceRoleKey: string;
  fetchImpl?: typeof fetch;
};

type SupabaseTableRow = {
  id: string;
  name: string;
  status: string;
  small_bet: number;
  big_bet: number;
  ante: number;
  bring_in: number;
  min_players: number;
  max_players: number;
  mix_index: number;
  hands_since_rotation: number;
  dealer_seat: number;
};

type SupabaseTableSeatRow = {
  seat_no: number;
  status: string;
  user_id: string | null;
  stack: number;
  joined_at: string | null;
  disconnect_streak: number;
};

type SupabaseUserRow = {
  id: string;
  display_name: string;
};

type SupabaseHandRow = {
  id: string;
  hand_no: number;
  status: string;
};

type SupabaseHandEventRow = {
  payload: unknown;
};

type SupabaseTableSnapshotRow = {
  payload: unknown;
};

type SnapshotCurrentHand = {
  handId: string;
  street: (typeof Street)[keyof typeof Street];
  potTotal: number;
  streetBetTo: number;
  raiseCount: number;
  toActSeatNo: number | null;
  actionDeadlineAt: string | null;
};

type HandEventContext = {
  street: (typeof Street)[keyof typeof Street];
  potTotal: number;
  streetBetTo: number;
  raiseCount: number;
  toActSeatNo: number | null;
  actionDeadlineAt: string | null;
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

const parseSingleTableRow = (payload: unknown): SupabaseTableRow | null => {
  if (!Array.isArray(payload) || payload.length === 0) {
    return null;
  }

  const row = payload[0];
  if (!isRecord(row)) {
    throw new Error("Supabase tables response row is invalid.");
  }

  const id = row.id;
  const name = row.name;
  const status = row.status;
  const smallBet = row.small_bet;
  const bigBet = row.big_bet;
  const ante = row.ante;
  const bringIn = row.bring_in;
  const minPlayers = row.min_players;
  const maxPlayers = row.max_players;
  const mixIndex = row.mix_index;
  const handsSinceRotation = row.hands_since_rotation;
  const dealerSeat = row.dealer_seat;

  if (
    typeof id !== "string" ||
    typeof name !== "string" ||
    typeof status !== "string" ||
    typeof smallBet !== "number" ||
    typeof bigBet !== "number" ||
    typeof ante !== "number" ||
    typeof bringIn !== "number" ||
    typeof minPlayers !== "number" ||
    typeof maxPlayers !== "number" ||
    typeof mixIndex !== "number" ||
    typeof handsSinceRotation !== "number" ||
    typeof dealerSeat !== "number"
  ) {
    throw new Error("Supabase tables row has invalid fields.");
  }

  return {
    id,
    name,
    status,
    small_bet: smallBet,
    big_bet: bigBet,
    ante,
    bring_in: bringIn,
    min_players: minPlayers,
    max_players: maxPlayers,
    mix_index: mixIndex,
    hands_since_rotation: handsSinceRotation,
    dealer_seat: dealerSeat,
  };
};

const parseTableSeatRows = (payload: unknown): SupabaseTableSeatRow[] => {
  if (!Array.isArray(payload)) {
    throw new Error("Supabase table_seats response is not an array.");
  }

  return payload.map((item) => {
    if (!isRecord(item)) {
      throw new Error("Supabase table_seats response row is invalid.");
    }

    const seatNo = item.seat_no;
    const status = item.status;
    const userId = item.user_id;
    const stack = item.stack;
    const joinedAt = item.joined_at;
    const disconnectStreak = item.disconnect_streak;

    if (
      typeof seatNo !== "number" ||
      typeof status !== "string" ||
      (userId !== null && typeof userId !== "string") ||
      typeof stack !== "number" ||
      (joinedAt !== null && typeof joinedAt !== "string") ||
      typeof disconnectStreak !== "number"
    ) {
      throw new Error("Supabase table_seats row has invalid fields.");
    }

    return {
      seat_no: seatNo,
      status,
      user_id: userId,
      stack,
      joined_at: joinedAt,
      disconnect_streak: disconnectStreak,
    };
  });
};

const parseUserRows = (payload: unknown): SupabaseUserRow[] => {
  if (!Array.isArray(payload)) {
    throw new Error("Supabase users response is not an array.");
  }

  return payload.map((item) => {
    if (!isRecord(item)) {
      throw new Error("Supabase users response row is invalid.");
    }

    const id = item.id;
    const displayName = item.display_name;
    if (typeof id !== "string" || typeof displayName !== "string") {
      throw new Error("Supabase users row has invalid fields.");
    }

    return {
      id,
      display_name: displayName,
    };
  });
};

const parseSingleHandRow = (payload: unknown): SupabaseHandRow | null => {
  if (!Array.isArray(payload) || payload.length === 0) {
    return null;
  }

  const row = payload[0];
  if (!isRecord(row)) {
    throw new Error("Supabase hands response row is invalid.");
  }

  const id = row.id;
  const handNo = row.hand_no;
  const status = row.status;
  if (
    typeof id !== "string" ||
    typeof handNo !== "number" ||
    typeof status !== "string"
  ) {
    throw new Error("Supabase hands row has invalid fields.");
  }

  return {
    id,
    hand_no: handNo,
    status,
  };
};

const parseHandEventRows = (payload: unknown): SupabaseHandEventRow[] => {
  if (!Array.isArray(payload)) {
    throw new Error("Supabase hand_events response is not an array.");
  }

  return payload.map((item) => {
    if (!isRecord(item)) {
      throw new Error("Supabase hand_events response row is invalid.");
    }

    return {
      payload: item.payload,
    };
  });
};

const parseSnapshotRows = (payload: unknown): SupabaseTableSnapshotRow[] => {
  if (!Array.isArray(payload)) {
    throw new Error("Supabase table_snapshots response is not an array.");
  }

  return payload.map((item) => {
    if (!isRecord(item)) {
      throw new Error("Supabase table_snapshots response row is invalid.");
    }

    return {
      payload: item.payload,
    };
  });
};

const toGameType = (
  mixIndex: number,
): (typeof GameType)[keyof typeof GameType] => {
  switch (mixIndex) {
    case 1:
      return GameType.RAZZ;
    case 2:
      return GameType.STUD_8;
    default:
      return GameType.STUD_HI;
  }
};

const toInFilter = (values: string[]) => `in.(${values.join(",")})`;

const toDefaultSeatRecord = (seatNo: number): TableSeatRecord => ({
  seatNo,
  status: SeatStatus.EMPTY,
  userId: null,
  displayName: null,
  stack: 0,
  isYou: false,
  joinedAt: null,
  disconnectStreak: null,
});

const parseSnapshotCurrentHand = (
  payload: unknown,
): SnapshotCurrentHand | null => {
  if (!isRecord(payload)) {
    return null;
  }

  const table = payload.table;
  if (!isRecord(table)) {
    return null;
  }

  const currentHand = table.currentHand;
  if (!isRecord(currentHand)) {
    return null;
  }

  const handId = currentHand.handId;
  const street = currentHand.street;
  const potTotal = currentHand.potTotal;
  const streetBetTo = currentHand.streetBetTo;
  const raiseCount = currentHand.raiseCount;
  const toActSeatNo = currentHand.toActSeatNo;
  const actionDeadlineAt = currentHand.actionDeadlineAt;
  if (
    typeof handId !== "string" ||
    !isStreet(street) ||
    typeof potTotal !== "number" ||
    typeof streetBetTo !== "number" ||
    typeof raiseCount !== "number"
  ) {
    return null;
  }

  return {
    handId,
    street,
    potTotal,
    streetBetTo,
    raiseCount,
    toActSeatNo: typeof toActSeatNo === "number" ? toActSeatNo : null,
    actionDeadlineAt:
      typeof actionDeadlineAt === "string" ? actionDeadlineAt : null,
  };
};

const parseEventContext = (
  eventRows: SupabaseHandEventRow[],
): HandEventContext => {
  let street: (typeof Street)[keyof typeof Street] | null = null;
  let potTotal: number | null = null;
  let streetBetTo: number | null = null;
  let raiseCount: number | null = null;
  let toActSeatNo: number | null = null;
  let actionDeadlineAt: string | null = null;

  for (const row of eventRows) {
    if (!isRecord(row.payload)) {
      continue;
    }

    const payload = row.payload;
    const payloadStreet = payload.street;
    const payloadToStreet = payload.toStreet;
    const payloadPotAfter = payload.potAfter;
    const payloadPotTotal = payload.potTotal;
    const payloadToActSeatNo = payload.toActSeatNo;
    const payloadNextToActSeatNo = payload.nextToActSeatNo;
    const payloadStreetBetTo = payload.streetBetTo;
    const payloadRaiseCount = payload.raiseCount;
    const payloadActionDeadlineAt = payload.actionDeadlineAt;

    if (street === null) {
      if (isStreet(payloadStreet)) {
        street = payloadStreet;
      } else if (isStreet(payloadToStreet)) {
        street = payloadToStreet;
      }
    }

    if (potTotal === null) {
      if (typeof payloadPotAfter === "number") {
        potTotal = payloadPotAfter;
      } else if (typeof payloadPotTotal === "number") {
        potTotal = payloadPotTotal;
      }
    }

    if (streetBetTo === null) {
      if (typeof payloadStreetBetTo === "number") {
        streetBetTo = payloadStreetBetTo;
      } else if (typeof payload.amount === "number") {
        streetBetTo = payload.amount;
      }
    }

    if (raiseCount === null && typeof payloadRaiseCount === "number") {
      raiseCount = payloadRaiseCount;
    }

    if (toActSeatNo === null) {
      if (typeof payloadToActSeatNo === "number") {
        toActSeatNo = payloadToActSeatNo;
      } else if (typeof payloadNextToActSeatNo === "number") {
        toActSeatNo = payloadNextToActSeatNo;
      }
    }

    if (
      actionDeadlineAt === null &&
      typeof payloadActionDeadlineAt === "string"
    ) {
      actionDeadlineAt = payloadActionDeadlineAt;
    }

    if (
      street !== null &&
      potTotal !== null &&
      streetBetTo !== null &&
      raiseCount !== null &&
      toActSeatNo !== null &&
      actionDeadlineAt !== null
    ) {
      break;
    }
  }

  return {
    street: street ?? Street.THIRD,
    potTotal: potTotal ?? 0,
    streetBetTo: streetBetTo ?? 0,
    raiseCount: raiseCount ?? 0,
    toActSeatNo,
    actionDeadlineAt,
  };
};

export const createSupabaseTableDetailRepository = (
  options: SupabaseTableDetailRepositoryOptions,
): TableDetailRepository => {
  const fetchImpl = options.fetchImpl ?? fetch;
  const authorizationHeaderValue = `Bearer ${options.serviceRoleKey}`;

  const fetchUsersMap = async (userIds: string[]) => {
    const uniqueUserIds = Array.from(new Set(userIds));
    if (uniqueUserIds.length === 0) {
      return new Map<string, string>();
    }

    const usersUrl = new URL(REST_USERS_PATH, options.supabaseUrl);
    usersUrl.searchParams.set("select", "id,display_name");
    usersUrl.searchParams.set("id", toInFilter(uniqueUserIds));

    const usersResponse = await fetchImpl(usersUrl, {
      method: "GET",
      headers: {
        apikey: options.serviceRoleKey,
        Authorization: authorizationHeaderValue,
      },
    });

    if (!usersResponse.ok) {
      throw await toError({
        response: usersResponse,
        step: "Supabase users select",
      });
    }

    const userRows = parseUserRows(await usersResponse.json());
    return new Map<string, string>(
      userRows.map((row) => [row.id, row.display_name]),
    );
  };

  const fetchCurrentHand = async (
    tableId: string,
  ): Promise<CurrentHandSummaryRecord | null> => {
    const handUrl = new URL(REST_HANDS_PATH, options.supabaseUrl);
    handUrl.searchParams.set("table_id", `eq.${tableId}`);
    handUrl.searchParams.set("status", `neq.${HandStatus.HAND_END}`);
    handUrl.searchParams.set("select", "id,hand_no,status");
    handUrl.searchParams.set("order", "hand_no.desc");
    handUrl.searchParams.set("limit", "1");

    const handResponse = await fetchImpl(handUrl, {
      method: "GET",
      headers: {
        apikey: options.serviceRoleKey,
        Authorization: authorizationHeaderValue,
      },
    });

    if (!handResponse.ok) {
      throw await toError({
        response: handResponse,
        step: "Supabase hands select",
      });
    }

    const handRow = parseSingleHandRow(await handResponse.json());
    if (!handRow) {
      return null;
    }

    const snapshotUrl = new URL(REST_TABLE_SNAPSHOTS_PATH, options.supabaseUrl);
    snapshotUrl.searchParams.set("table_id", `eq.${tableId}`);
    snapshotUrl.searchParams.set("select", "payload");
    snapshotUrl.searchParams.set("order", "table_seq.desc");
    snapshotUrl.searchParams.set("limit", "1");

    const snapshotResponse = await fetchImpl(snapshotUrl, {
      method: "GET",
      headers: {
        apikey: options.serviceRoleKey,
        Authorization: authorizationHeaderValue,
      },
    });

    if (!snapshotResponse.ok) {
      throw await toError({
        response: snapshotResponse,
        step: "Supabase table_snapshots select",
      });
    }

    const snapshotRows = parseSnapshotRows(await snapshotResponse.json());
    const latestSnapshotCurrentHand =
      snapshotRows.length > 0
        ? parseSnapshotCurrentHand(snapshotRows[0]?.payload)
        : null;

    const handEventsUrl = new URL(REST_HAND_EVENTS_PATH, options.supabaseUrl);
    handEventsUrl.searchParams.set("table_id", `eq.${tableId}`);
    handEventsUrl.searchParams.set("hand_id", `eq.${handRow.id}`);
    handEventsUrl.searchParams.set("select", "payload");
    handEventsUrl.searchParams.set("order", "hand_seq.desc");
    handEventsUrl.searchParams.set("limit", "32");

    const handEventsResponse = await fetchImpl(handEventsUrl, {
      method: "GET",
      headers: {
        apikey: options.serviceRoleKey,
        Authorization: authorizationHeaderValue,
      },
    });

    if (!handEventsResponse.ok) {
      throw await toError({
        response: handEventsResponse,
        step: "Supabase hand_events select",
      });
    }

    const handEventRows = parseHandEventRows(await handEventsResponse.json());
    const eventContext = parseEventContext(handEventRows);
    const snapshotContext =
      latestSnapshotCurrentHand &&
      latestSnapshotCurrentHand.handId === handRow.id
        ? latestSnapshotCurrentHand
        : null;

    return {
      handId: handRow.id,
      handNo: handRow.hand_no,
      status: parseHandStatus(handRow.status),
      street: snapshotContext?.street ?? eventContext.street,
      potTotal: snapshotContext?.potTotal ?? eventContext.potTotal,
      streetBetTo: snapshotContext?.streetBetTo ?? eventContext.streetBetTo,
      raiseCount: snapshotContext?.raiseCount ?? eventContext.raiseCount,
      toActSeatNo: snapshotContext?.toActSeatNo ?? eventContext.toActSeatNo,
      actionDeadlineAt:
        snapshotContext?.actionDeadlineAt ?? eventContext.actionDeadlineAt,
    };
  };

  return {
    async getById(tableId) {
      const tableUrl = new URL(REST_TABLES_PATH, options.supabaseUrl);
      tableUrl.searchParams.set("id", `eq.${tableId}`);
      tableUrl.searchParams.set(
        "select",
        "id,name,status,small_bet,big_bet,ante,bring_in,min_players,max_players,mix_index,hands_since_rotation,dealer_seat",
      );
      tableUrl.searchParams.set("limit", "1");

      const tableResponse = await fetchImpl(tableUrl, {
        method: "GET",
        headers: {
          apikey: options.serviceRoleKey,
          Authorization: authorizationHeaderValue,
        },
      });

      if (!tableResponse.ok) {
        throw await toError({
          response: tableResponse,
          step: "Supabase tables select by id",
        });
      }

      const tableRow = parseSingleTableRow(await tableResponse.json());
      if (!tableRow) {
        return null;
      }

      const tableSeatsUrl = new URL(REST_TABLE_SEATS_PATH, options.supabaseUrl);
      tableSeatsUrl.searchParams.set("table_id", `eq.${tableId}`);
      tableSeatsUrl.searchParams.set(
        "select",
        "seat_no,status,user_id,stack,joined_at,disconnect_streak",
      );
      tableSeatsUrl.searchParams.set("order", "seat_no.asc");

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
          step: "Supabase table_seats select by table_id",
        });
      }

      const tableSeatRows = parseTableSeatRows(await tableSeatsResponse.json());
      const usersMap = await fetchUsersMap(
        tableSeatRows
          .map((row) => row.user_id)
          .filter((userId): userId is string => userId !== null),
      );

      const seatsBySeatNo = new Map<number, TableSeatRecord>();
      for (const row of tableSeatRows) {
        seatsBySeatNo.set(row.seat_no, {
          seatNo: row.seat_no,
          status: parseSeatStatus(row.status),
          userId: row.user_id,
          displayName: row.user_id ? (usersMap.get(row.user_id) ?? null) : null,
          stack: row.stack,
          isYou: false,
          joinedAt: row.joined_at,
          disconnectStreak: row.user_id ? row.disconnect_streak : null,
        });
      }

      const seats = Array.from({ length: 6 }, (_, index) => {
        const seatNo = index + 1;
        return seatsBySeatNo.get(seatNo) ?? toDefaultSeatRecord(seatNo);
      });

      const currentHand = await fetchCurrentHand(tableId);

      return {
        tableId: tableRow.id,
        tableName: tableRow.name,
        status: parseTableStatus(tableRow.status),
        gameType: toGameType(tableRow.mix_index),
        mixIndex: tableRow.mix_index,
        handsSinceRotation: tableRow.hands_since_rotation,
        dealerSeatNo: tableRow.dealer_seat,
        smallBet: tableRow.small_bet,
        bigBet: tableRow.big_bet,
        ante: tableRow.ante,
        bringIn: tableRow.bring_in,
        minPlayers: tableRow.min_players,
        maxPlayers: tableRow.max_players,
        seats,
        currentHand,
      } as TableDetailRecord;
    },
  };
};

import {
  ActionType,
  PotSide,
  Street,
  TableEventName,
} from "@mix-online/shared";
import type {
  HandActionRecord,
  HandHistoryDetailRecord,
  HandHistoryListItemRecord,
  HandParticipantRecord,
  PotResultRecord,
  StreetActionGroupRecord,
} from "../../history-hand";
import {
  isActionType,
  isGameType,
  isPotSide,
  isRecord,
  isStreet,
} from "../shared/guards";
import type { HistoryRepository } from "./contract";

const REST_HANDS_PATH = "/rest/v1/hands";
const REST_HAND_PLAYERS_PATH = "/rest/v1/hand_players";
const REST_HAND_EVENTS_PATH = "/rest/v1/hand_events";
const REST_HAND_RESULTS_PATH = "/rest/v1/hand_results";
const REST_USERS_PATH = "/rest/v1/users";
const REST_TABLES_PATH = "/rest/v1/tables";

type SupabaseHistoryRepositoryOptions = {
  supabaseUrl: string;
  serviceRoleKey: string;
  fetchImpl?: typeof fetch;
};

type SupabaseHandRow = {
  id: string;
  table_id: string;
  hand_no: number;
  game_type: string;
  started_at: string;
  ended_at: string | null;
};

type SupabaseHandPlayerRow = {
  hand_id: string;
  user_id: string;
  seat_no: number;
  result_delta: number | null;
  cards_up: unknown;
  cards_down: unknown;
};

type SupabaseUserHandMembershipRow = {
  hand_id: string;
  result_delta: number | null;
};

type SupabaseHandEventRow = {
  hand_seq: number;
  event_name: string;
  payload: unknown;
  created_at: string;
};

type SupabaseHandResultRow = {
  pot_no: number;
  side: string;
  winner_user_id: string;
  amount: number;
};

type SupabaseUserRow = {
  id: string;
  display_name: string;
};

type SupabaseTableRow = {
  id: string;
  name: string;
};

const POT_SIDE_ORDER = {
  [PotSide.SCOOP]: 0,
  [PotSide.HI]: 1,
  [PotSide.LO]: 2,
} as const;

const EVENT_NAME_TO_ACTION_TYPE: Partial<
  Record<string, (typeof ActionType)[keyof typeof ActionType]>
> = {
  [TableEventName.PostAnteEvent]: ActionType.ANTE,
  [TableEventName.BringInEvent]: ActionType.BRING_IN,
  [TableEventName.CompleteEvent]: ActionType.COMPLETE,
  [TableEventName.BetEvent]: ActionType.BET,
  [TableEventName.RaiseEvent]: ActionType.RAISE,
  [TableEventName.CallEvent]: ActionType.CALL,
  [TableEventName.CheckEvent]: ActionType.CHECK,
  [TableEventName.FoldEvent]: ActionType.FOLD,
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

const toInFilter = (values: string[]) => `in.(${values.join(",")})`;

const toSortedUnique = (values: string[]) => Array.from(new Set(values)).sort();

const parseCards = (value: unknown): string[] | null => {
  if (!Array.isArray(value)) {
    return null;
  }

  return value.every((card) => typeof card === "string")
    ? (value as string[])
    : null;
};

const parseUserHandMembershipRows = (
  payload: unknown,
): SupabaseUserHandMembershipRow[] => {
  if (!Array.isArray(payload)) {
    throw new Error(
      "Supabase hand_players membership response is not an array.",
    );
  }

  return payload.map((item) => {
    if (!isRecord(item)) {
      throw new Error("Supabase hand_players membership row is invalid.");
    }

    const handId = item.hand_id;
    const resultDelta = item.result_delta;
    if (typeof handId !== "string") {
      throw new Error(
        "Supabase hand_players membership row has invalid hand_id.",
      );
    }
    if (resultDelta !== null && typeof resultDelta !== "number") {
      throw new Error(
        "Supabase hand_players membership row has invalid result_delta.",
      );
    }

    return {
      hand_id: handId,
      result_delta: resultDelta,
    };
  });
};

const parseHandRows = (payload: unknown): SupabaseHandRow[] => {
  if (!Array.isArray(payload)) {
    throw new Error("Supabase hands response is not an array.");
  }

  return payload.map((item) => {
    if (!isRecord(item)) {
      throw new Error("Supabase hands response row is invalid.");
    }

    const id = item.id;
    const tableId = item.table_id;
    const handNo = item.hand_no;
    const gameType = item.game_type;
    const startedAt = item.started_at;
    const endedAt = item.ended_at;
    if (
      typeof id !== "string" ||
      typeof tableId !== "string" ||
      typeof handNo !== "number" ||
      typeof gameType !== "string" ||
      typeof startedAt !== "string" ||
      (endedAt !== null && typeof endedAt !== "string")
    ) {
      throw new Error("Supabase hands row has invalid fields.");
    }

    return {
      id,
      table_id: tableId,
      hand_no: handNo,
      game_type: gameType,
      started_at: startedAt,
      ended_at: endedAt,
    };
  });
};

const parseHandPlayerRows = (payload: unknown): SupabaseHandPlayerRow[] => {
  if (!Array.isArray(payload)) {
    throw new Error("Supabase hand_players response is not an array.");
  }

  return payload.map((item) => {
    if (!isRecord(item)) {
      throw new Error("Supabase hand_players response row is invalid.");
    }

    const handId = item.hand_id;
    const userId = item.user_id;
    const seatNo = item.seat_no;
    const resultDelta = item.result_delta;
    if (
      typeof handId !== "string" ||
      typeof userId !== "string" ||
      typeof seatNo !== "number" ||
      (resultDelta !== null && typeof resultDelta !== "number")
    ) {
      throw new Error("Supabase hand_players row has invalid fields.");
    }

    return {
      hand_id: handId,
      user_id: userId,
      seat_no: seatNo,
      result_delta: resultDelta,
      cards_up: item.cards_up,
      cards_down: item.cards_down,
    };
  });
};

const parseHandEventRows = (payload: unknown): SupabaseHandEventRow[] => {
  if (!Array.isArray(payload)) {
    throw new Error("Supabase hand_events response is not an array.");
  }

  return payload.map((item) => {
    if (!isRecord(item)) {
      throw new Error("Supabase hand_events response row is invalid.");
    }

    const handSeq = item.hand_seq;
    const eventName = item.event_name;
    const createdAt = item.created_at;
    if (
      typeof handSeq !== "number" ||
      typeof eventName !== "string" ||
      typeof createdAt !== "string"
    ) {
      throw new Error("Supabase hand_events row has invalid fields.");
    }

    return {
      hand_seq: handSeq,
      event_name: eventName,
      payload: item.payload,
      created_at: createdAt,
    };
  });
};

const parseHandResultRows = (payload: unknown): SupabaseHandResultRow[] => {
  if (!Array.isArray(payload)) {
    throw new Error("Supabase hand_results response is not an array.");
  }

  return payload.map((item) => {
    if (!isRecord(item)) {
      throw new Error("Supabase hand_results response row is invalid.");
    }

    const potNo = item.pot_no;
    const side = item.side;
    const winnerUserId = item.winner_user_id;
    const amount = item.amount;
    if (
      typeof potNo !== "number" ||
      typeof side !== "string" ||
      typeof winnerUserId !== "string" ||
      typeof amount !== "number"
    ) {
      throw new Error("Supabase hand_results row has invalid fields.");
    }

    return {
      pot_no: potNo,
      side,
      winner_user_id: winnerUserId,
      amount,
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
    if (typeof id !== "string" || typeof name !== "string") {
      throw new Error("Supabase tables row has invalid fields.");
    }

    return {
      id,
      name,
    };
  });
};

const resolveDisplayName = (params: {
  userId: string;
  usersMap: Map<string, string>;
}) => {
  return params.usersMap.get(params.userId) ?? params.userId;
};

const toHandParticipant = (params: {
  row: SupabaseHandPlayerRow;
  usersMap: Map<string, string>;
}): HandParticipantRecord => {
  return {
    userId: params.row.user_id,
    displayName: resolveDisplayName({
      userId: params.row.user_id,
      usersMap: params.usersMap,
    }),
    seatNo: params.row.seat_no,
    resultDelta: params.row.result_delta,
    shownCardsUp: parseCards(params.row.cards_up),
    shownCardsDown: parseCards(params.row.cards_down),
  };
};

const toActionType = (params: {
  eventName: string;
  payload: Record<string, unknown>;
}) => {
  const baseActionType = EVENT_NAME_TO_ACTION_TYPE[params.eventName];
  if (!baseActionType) {
    return null;
  }

  const isAuto = params.payload.isAuto === true;
  if (params.eventName === TableEventName.CheckEvent) {
    return isAuto ? ActionType.AUTO_CHECK : ActionType.CHECK;
  }

  if (params.eventName === TableEventName.FoldEvent) {
    return isAuto ? ActionType.AUTO_FOLD : ActionType.FOLD;
  }

  return baseActionType;
};

const toHandAction = (params: {
  event: SupabaseHandEventRow;
  participantsBySeatNo: Map<number, HandParticipantRecord>;
}): {
  street: (typeof Street)[keyof typeof Street];
  action: HandActionRecord;
} | null => {
  if (!isRecord(params.event.payload)) {
    return null;
  }

  const payload = params.event.payload;
  const actionType = toActionType({
    eventName: params.event.event_name,
    payload,
  });
  if (!actionType || !isActionType(actionType)) {
    return null;
  }

  const seatNo = payload.seatNo;
  if (typeof seatNo !== "number") {
    return null;
  }

  const participant = params.participantsBySeatNo.get(seatNo);
  const userIdFromPayload = payload.userId;
  const displayNameFromPayload = payload.displayName;
  const streetFromPayload = payload.street;
  const streetFromToStreet = payload.toStreet;
  const amount = payload.amount;
  const potAfterFromPayload = payload.potAfter;
  const potTotalFromPayload = payload.potTotal;

  const street = isStreet(streetFromPayload)
    ? streetFromPayload
    : isStreet(streetFromToStreet)
      ? streetFromToStreet
      : Street.THIRD;

  return {
    street,
    action: {
      seq: params.event.hand_seq,
      actionType,
      seatNo,
      isAuto:
        actionType === ActionType.AUTO_CHECK ||
        actionType === ActionType.AUTO_FOLD,
      userId:
        typeof userIdFromPayload === "string"
          ? userIdFromPayload
          : (participant?.userId ?? null),
      displayName:
        typeof displayNameFromPayload === "string"
          ? displayNameFromPayload
          : (participant?.displayName ?? null),
      amount: typeof amount === "number" ? amount : null,
      potAfter:
        typeof potAfterFromPayload === "number"
          ? potAfterFromPayload
          : typeof potTotalFromPayload === "number"
            ? potTotalFromPayload
            : null,
      occurredAt: params.event.created_at,
    },
  };
};

const buildStreetActions = (params: {
  eventRows: SupabaseHandEventRow[];
  participantsBySeatNo: Map<number, HandParticipantRecord>;
}) => {
  const groups: StreetActionGroupRecord[] = [];
  const groupByStreet = new Map<string, StreetActionGroupRecord>();

  for (const event of params.eventRows) {
    const parsed = toHandAction({
      event,
      participantsBySeatNo: params.participantsBySeatNo,
    });
    if (!parsed) {
      continue;
    }

    let group = groupByStreet.get(parsed.street);
    if (!group) {
      group = {
        street: parsed.street,
        actions: [],
      };
      groupByStreet.set(parsed.street, group);
      groups.push(group);
    }

    group.actions.push(parsed.action);
  }

  return groups;
};

export const createSupabaseHistoryRepository = (
  options: SupabaseHistoryRepositoryOptions,
): HistoryRepository => {
  const fetchImpl = options.fetchImpl ?? fetch;
  const authorizationHeaderValue = `Bearer ${options.serviceRoleKey}`;

  const fetchUsersMap = async (userIds: string[]) => {
    const uniqueUserIds = toSortedUnique(userIds);
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
        step: "Supabase users select for history",
      });
    }

    const userRows = parseUserRows(await usersResponse.json());
    return new Map<string, string>(
      userRows.map((row) => [row.id, row.display_name]),
    );
  };

  const fetchTableNameMap = async (tableIds: string[]) => {
    const uniqueTableIds = toSortedUnique(tableIds);
    if (uniqueTableIds.length === 0) {
      return new Map<string, string>();
    }

    const tablesUrl = new URL(REST_TABLES_PATH, options.supabaseUrl);
    tablesUrl.searchParams.set("select", "id,name");
    tablesUrl.searchParams.set("id", toInFilter(uniqueTableIds));

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
        step: "Supabase tables select for history",
      });
    }

    const tableRows = parseTableRows(await tablesResponse.json());
    return new Map<string, string>(tableRows.map((row) => [row.id, row.name]));
  };

  const fetchParticipantRows = async (handIds: string[]) => {
    const uniqueHandIds = toSortedUnique(handIds);
    if (uniqueHandIds.length === 0) {
      return [] as SupabaseHandPlayerRow[];
    }

    const participantsUrl = new URL(
      REST_HAND_PLAYERS_PATH,
      options.supabaseUrl,
    );
    participantsUrl.searchParams.set(
      "select",
      "hand_id,user_id,seat_no,result_delta,cards_up,cards_down",
    );
    participantsUrl.searchParams.set("hand_id", toInFilter(uniqueHandIds));

    const participantsResponse = await fetchImpl(participantsUrl, {
      method: "GET",
      headers: {
        apikey: options.serviceRoleKey,
        Authorization: authorizationHeaderValue,
      },
    });

    if (!participantsResponse.ok) {
      throw await toError({
        response: participantsResponse,
        step: "Supabase hand_players select for participants",
      });
    }

    return parseHandPlayerRows(await participantsResponse.json());
  };

  return {
    async listHands(userId) {
      const membershipUrl = new URL(
        REST_HAND_PLAYERS_PATH,
        options.supabaseUrl,
      );
      membershipUrl.searchParams.set("user_id", `eq.${userId}`);
      membershipUrl.searchParams.set("select", "hand_id,result_delta");

      const membershipResponse = await fetchImpl(membershipUrl, {
        method: "GET",
        headers: {
          apikey: options.serviceRoleKey,
          Authorization: authorizationHeaderValue,
        },
      });

      if (!membershipResponse.ok) {
        throw await toError({
          response: membershipResponse,
          step: "Supabase hand_players select by user_id",
        });
      }

      const membershipRows = parseUserHandMembershipRows(
        await membershipResponse.json(),
      );
      if (membershipRows.length === 0) {
        return [];
      }

      const handIds = toSortedUnique(membershipRows.map((row) => row.hand_id));
      const profitLossByHandId = new Map(
        membershipRows.map((row) => [row.hand_id, row.result_delta ?? 0]),
      );

      const handsUrl = new URL(REST_HANDS_PATH, options.supabaseUrl);
      handsUrl.searchParams.set(
        "select",
        "id,table_id,hand_no,game_type,started_at,ended_at",
      );
      handsUrl.searchParams.set("id", toInFilter(handIds));
      handsUrl.searchParams.set("ended_at", "not.is.null");

      const handsResponse = await fetchImpl(handsUrl, {
        method: "GET",
        headers: {
          apikey: options.serviceRoleKey,
          Authorization: authorizationHeaderValue,
        },
      });

      if (!handsResponse.ok) {
        throw await toError({
          response: handsResponse,
          step: "Supabase hands select by ids",
        });
      }

      const handRows = parseHandRows(await handsResponse.json());
      if (handRows.length === 0) {
        return [];
      }

      const participants = await fetchParticipantRows(
        handRows.map((row) => row.id),
      );
      const usersMap = await fetchUsersMap(
        participants.map((participant) => participant.user_id),
      );
      const tableNameMap = await fetchTableNameMap(
        handRows.map((row) => row.table_id),
      );

      const participantsByHandId = new Map<string, HandParticipantRecord[]>();
      for (const row of participants) {
        const participant = toHandParticipant({
          row,
          usersMap,
        });
        const list = participantsByHandId.get(row.hand_id) ?? [];
        list.push(participant);
        participantsByHandId.set(row.hand_id, list);
      }

      const items: HandHistoryListItemRecord[] = [];
      for (const hand of handRows) {
        if (!isGameType(hand.game_type) || hand.ended_at === null) {
          continue;
        }

        const handParticipants = (participantsByHandId.get(hand.id) ?? []).sort(
          (left, right) => left.seatNo - right.seatNo,
        );
        items.push({
          handId: hand.id,
          tableId: hand.table_id,
          tableName: tableNameMap.get(hand.table_id),
          handNo: hand.hand_no,
          gameType: hand.game_type,
          participants: handParticipants,
          startedAt: hand.started_at,
          endedAt: hand.ended_at,
          profitLoss: profitLossByHandId.get(hand.id) ?? 0,
        });
      }

      return items.sort((left, right) => {
        if (left.endedAt !== right.endedAt) {
          return right.endedAt.localeCompare(left.endedAt);
        }
        return right.handId.localeCompare(left.handId);
      });
    },

    async getHandDetail(userId, handId) {
      const membershipUrl = new URL(
        REST_HAND_PLAYERS_PATH,
        options.supabaseUrl,
      );
      membershipUrl.searchParams.set("user_id", `eq.${userId}`);
      membershipUrl.searchParams.set("hand_id", `eq.${handId}`);
      membershipUrl.searchParams.set("select", "hand_id,result_delta");
      membershipUrl.searchParams.set("limit", "1");

      const membershipResponse = await fetchImpl(membershipUrl, {
        method: "GET",
        headers: {
          apikey: options.serviceRoleKey,
          Authorization: authorizationHeaderValue,
        },
      });

      if (!membershipResponse.ok) {
        throw await toError({
          response: membershipResponse,
          step: "Supabase hand_players membership select by user_id and hand_id",
        });
      }

      const membershipRows = parseUserHandMembershipRows(
        await membershipResponse.json(),
      );
      if (membershipRows.length === 0) {
        return null;
      }

      const handsUrl = new URL(REST_HANDS_PATH, options.supabaseUrl);
      handsUrl.searchParams.set(
        "select",
        "id,table_id,hand_no,game_type,started_at,ended_at",
      );
      handsUrl.searchParams.set("id", `eq.${handId}`);
      handsUrl.searchParams.set("limit", "1");

      const handsResponse = await fetchImpl(handsUrl, {
        method: "GET",
        headers: {
          apikey: options.serviceRoleKey,
          Authorization: authorizationHeaderValue,
        },
      });

      if (!handsResponse.ok) {
        throw await toError({
          response: handsResponse,
          step: "Supabase hands select by hand_id",
        });
      }

      const handRows = parseHandRows(await handsResponse.json());
      const hand = handRows[0];
      if (!hand || !isGameType(hand.game_type) || hand.ended_at === null) {
        return null;
      }

      const participants = await fetchParticipantRows([hand.id]);
      const usersMap = await fetchUsersMap(
        participants.map((participant) => participant.user_id),
      );

      const tableNameMap = await fetchTableNameMap([hand.table_id]);
      const tableName = tableNameMap.get(hand.table_id);

      const participantsList = participants
        .map((row) => toHandParticipant({ row, usersMap }))
        .sort((left, right) => left.seatNo - right.seatNo);

      const participantsBySeatNo = new Map<number, HandParticipantRecord>(
        participantsList.map((participant) => [
          participant.seatNo,
          participant,
        ]),
      );

      const eventsUrl = new URL(REST_HAND_EVENTS_PATH, options.supabaseUrl);
      eventsUrl.searchParams.set("hand_id", `eq.${handId}`);
      eventsUrl.searchParams.set(
        "select",
        "hand_seq,event_name,payload,created_at",
      );
      eventsUrl.searchParams.set("order", "hand_seq.asc");

      const eventsResponse = await fetchImpl(eventsUrl, {
        method: "GET",
        headers: {
          apikey: options.serviceRoleKey,
          Authorization: authorizationHeaderValue,
        },
      });

      if (!eventsResponse.ok) {
        throw await toError({
          response: eventsResponse,
          step: "Supabase hand_events select by hand_id",
        });
      }

      const eventRows = parseHandEventRows(await eventsResponse.json());
      const streetActions = buildStreetActions({
        eventRows,
        participantsBySeatNo,
      });

      const handResultsUrl = new URL(
        REST_HAND_RESULTS_PATH,
        options.supabaseUrl,
      );
      handResultsUrl.searchParams.set("hand_id", `eq.${handId}`);
      handResultsUrl.searchParams.set(
        "select",
        "pot_no,side,winner_user_id,amount",
      );
      handResultsUrl.searchParams.set("order", "pot_no.asc");

      const handResultsResponse = await fetchImpl(handResultsUrl, {
        method: "GET",
        headers: {
          apikey: options.serviceRoleKey,
          Authorization: authorizationHeaderValue,
        },
      });

      if (!handResultsResponse.ok) {
        throw await toError({
          response: handResultsResponse,
          step: "Supabase hand_results select by hand_id",
        });
      }

      const handResultRows = parseHandResultRows(
        await handResultsResponse.json(),
      );
      const potResultsByKey = new Map<string, PotResultRecord>();

      for (const row of handResultRows) {
        if (!isPotSide(row.side)) {
          continue;
        }

        const key = `${row.pot_no}:${row.side}`;
        const existing = potResultsByKey.get(key);
        const winnerDisplayName = resolveDisplayName({
          userId: row.winner_user_id,
          usersMap,
        });

        if (existing) {
          existing.amount += row.amount;
          existing.winners.push({
            userId: row.winner_user_id,
            displayName: winnerDisplayName,
            amount: row.amount,
          });
          continue;
        }

        potResultsByKey.set(key, {
          potNo: row.pot_no,
          side: row.side,
          winners: [
            {
              userId: row.winner_user_id,
              displayName: winnerDisplayName,
              amount: row.amount,
            },
          ],
          amount: row.amount,
        });
      }

      const potResults = Array.from(potResultsByKey.values()).sort(
        (left, right) => {
          if (left.potNo !== right.potNo) {
            return left.potNo - right.potNo;
          }
          return POT_SIDE_ORDER[left.side] - POT_SIDE_ORDER[right.side];
        },
      );

      const detail: HandHistoryDetailRecord = {
        handId: hand.id,
        tableId: hand.table_id,
        tableName,
        handNo: hand.hand_no,
        gameType: hand.game_type,
        participants: participantsList,
        streetActions,
        showdown: {
          hasShowdown: potResults.length > 0,
          potResults,
        },
        profitLoss: membershipRows[0]?.result_delta ?? 0,
        startedAt: hand.started_at,
        endedAt: hand.ended_at,
      };

      return detail;
    },
  };
};

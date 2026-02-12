import type { IncomingMessage } from "node:http";
import {
  type RealtimeErrorCode,
  RealtimeErrorCode as RealtimeErrorCodeMap,
  type RealtimeTableCommand,
  RealtimeTableCommandType,
} from "@mix-online/shared";
import type { WebSocket } from "ws";
import {
  type SessionStore,
  type SessionUser,
  getSessionIdFromCookie,
} from "../auth-session";
import { toTableErrorMessage } from "../error-response";
import { isUuid, validateWsBaseCommand } from "../validation";
import {
  type RealtimeTableService,
  TABLE_RESUME_RESULT_KIND,
  createRealtimeTableService,
} from "./table-service";

type TimerHandle = ReturnType<typeof globalThis.setTimeout>;

type WsGatewayOptions = {
  sessionStore: SessionStore;
  now?: () => Date;
  tableService?: RealtimeTableService;
  actionTimeoutMs?: number;
  setTimeoutFn?: (callback: () => void, timeoutMs: number) => TimerHandle;
  clearTimeoutFn?: (timeoutId: TimerHandle) => void;
};

type GatewayConnection = {
  socket: WebSocket;
  request: IncomingMessage;
};

type TrackedConnection = GatewayConnection & {
  currentTableId: string | null;
  currentUser: SessionUser | null;
};

type ClientCommandContext = {
  requestId: string | null;
  tableId: string | null;
};

type JsonCommandParseSuccess = {
  ok: true;
  value: unknown;
};

type JsonCommandParseFailure = {
  ok: false;
};

type JsonCommandParseResult = JsonCommandParseSuccess | JsonCommandParseFailure;

const DEFAULT_ACTION_TIMEOUT_MS = 30_000;

const resolveTableIdFromPayload = (
  payload: Record<string, unknown>,
): string | null => {
  const rawTableId = payload.tableId;
  if (typeof rawTableId !== "string") {
    return null;
  }

  return isUuid(rawTableId) ? rawTableId : null;
};

const buildErrorPayload = (params: {
  code: RealtimeErrorCode;
  message: string;
  occurredAt: Date;
  context: ClientCommandContext;
}) =>
  toTableErrorMessage({
    code: params.code,
    message: params.message,
    occurredAt: params.occurredAt.toISOString(),
    requestId: params.context.requestId,
    tableId: params.context.tableId,
  });

export class WsGateway {
  private readonly sessionStore: SessionStore;
  private readonly now: () => Date;
  private readonly tableService: RealtimeTableService;
  private readonly actionTimeoutMs: number;
  private readonly setTimeoutFn: (
    callback: () => void,
    timeoutMs: number,
  ) => TimerHandle;
  private readonly clearTimeoutFn: (timeoutId: TimerHandle) => void;
  private readonly connections = new Set<TrackedConnection>();
  private readonly actionTimersByTableId = new Map<string, TimerHandle>();

  constructor(options: WsGatewayOptions) {
    this.sessionStore = options.sessionStore;
    this.now = options.now ?? (() => new Date());
    this.tableService = options.tableService ?? createRealtimeTableService();
    this.actionTimeoutMs = options.actionTimeoutMs ?? DEFAULT_ACTION_TIMEOUT_MS;
    this.setTimeoutFn =
      options.setTimeoutFn ??
      ((callback, timeoutMs) => globalThis.setTimeout(callback, timeoutMs));
    this.clearTimeoutFn =
      options.clearTimeoutFn ??
      ((timeoutId) => globalThis.clearTimeout(timeoutId));
  }

  handleConnection(connection: GatewayConnection): void {
    const trackedConnection: TrackedConnection = {
      ...connection,
      currentTableId: null,
      currentUser: null,
    };
    // 接続を追跡対象に追加
    this.connections.add(trackedConnection);

    // 切断を検知したら handleDisconnect を呼び出す
    trackedConnection.socket.on("close", () => {
      void this.handleDisconnect(trackedConnection);
    });

    // メッセージ受信を処理するリスナーを登録
    trackedConnection.socket.on("message", async (raw) => {
      const text = typeof raw === "string" ? raw : raw.toString("utf-8");
      const occurredAt = this.now();

      const commandContext: ClientCommandContext = {
        requestId: null,
        tableId: null,
      };

      const sessionId = getSessionIdFromCookie(
        trackedConnection.request.headers.cookie,
      );
      const session =
        sessionId === null
          ? null
          : this.sessionStore.findById(sessionId, occurredAt);

      if (session === null) {
        this.sendTableError({
          connection: trackedConnection,
          code: RealtimeErrorCodeMap.AUTH_EXPIRED,
          message: "認証の有効期限が切れています。",
          occurredAt,
          context: commandContext,
        });
        return;
      }

      trackedConnection.currentUser = session.user;

      // コマンドのパースとバリデーション
      const parsed = this.parseJsonCommand(
        text,
        trackedConnection,
        commandContext,
        occurredAt,
      );
      if (!parsed.ok) {
        return;
      }

      const baseCommand = this.validateCommand(
        parsed.value,
        trackedConnection,
        commandContext,
        occurredAt,
      );
      if (baseCommand === null) {
        return;
      }

      // 再接続コマンドの場合は特別処理 (再接続コマンドはテーブルIDを必ず含む)
      if (commandContext.tableId !== null) {
        trackedConnection.currentTableId = commandContext.tableId;
        const reconnectResult = await this.tableService.handleReconnect({
          tableId: commandContext.tableId,
          user: session.user,
          occurredAt,
        });
        if (reconnectResult.ok) {
          for (const event of reconnectResult.events) {
            this.broadcastToTable(reconnectResult.tableId, event, session.user);
          }
          this.scheduleAutoAction(reconnectResult.tableId);
        }
      }

      // ping コマンドの場合は pong を返すだけ
      if (baseCommand.type === "ping") {
        trackedConnection.socket.send(
          JSON.stringify({
            type: "pong",
            requestId: baseCommand.requestId,
            occurredAt: occurredAt.toISOString(),
          }),
        );
        return;
      }

      // resume コマンドの場合はテーブルサービスの resumeFrom を呼び出す
      if (baseCommand.type === RealtimeTableCommandType.RESUME) {
        const resumeTableId = commandContext.tableId;
        const lastTableSeq = baseCommand.payload.lastTableSeq;
        // payload の妥当性チェック
        if (
          resumeTableId === null ||
          typeof lastTableSeq !== "number" ||
          !Number.isInteger(lastTableSeq) ||
          lastTableSeq < 0
        ) {
          this.sendTableError({
            connection: trackedConnection,
            code: RealtimeErrorCodeMap.INVALID_ACTION,
            message: "table.resume の payload が不正です。",
            occurredAt,
            context: commandContext,
          });
          return;
        }

        const resumeResult = await this.tableService.resumeFrom({
          tableId: resumeTableId,
          lastTableSeq,
          occurredAt,
        });
        trackedConnection.currentTableId = resumeTableId;
        // イベントまたはスナップショットを送信
        if (resumeResult.kind === TABLE_RESUME_RESULT_KIND.EVENTS) {
          // イベント群を順次送信
          for (const event of resumeResult.events) {
            trackedConnection.socket.send(JSON.stringify(event));
          }
        } else {
          // スナップショットを送信
          trackedConnection.socket.send(JSON.stringify(resumeResult.snapshot));
        }
        this.scheduleAutoAction(resumeTableId);
        return;
      }

      // それ以外のコマンドはテーブルサービスに処理を委譲
      const command: RealtimeTableCommand = {
        type: baseCommand.type as RealtimeTableCommand["type"],
        requestId: baseCommand.requestId,
        sentAt: baseCommand.sentAt,
        payload: baseCommand.payload as RealtimeTableCommand["payload"],
      } as RealtimeTableCommand;

      const result = await this.tableService.executeCommand({
        command,
        user: session.user,
        occurredAt,
      });

      if (result.ok === false) {
        this.sendTableError({
          connection: trackedConnection,
          code: result.error.code,
          message: result.error.message,
          occurredAt,
          context: {
            requestId: result.error.requestId,
            tableId: result.error.tableId,
          },
        });
        return;
      }

      trackedConnection.currentTableId = result.tableId;
      for (const event of result.events) {
        this.broadcastToTable(result.tableId, event, session.user);
      }
      this.scheduleAutoAction(result.tableId);
    });
  }

  private async handleDisconnect(connection: TrackedConnection): Promise<void> {
    this.connections.delete(connection);

    if (!connection.currentTableId || !connection.currentUser) {
      return;
    }

    const result = await this.tableService.handleDisconnect({
      tableId: connection.currentTableId,
      user: connection.currentUser,
      occurredAt: this.now(),
    });

    if (result.ok) {
      for (const event of result.events) {
        this.broadcastToTable(result.tableId, event, connection.currentUser);
      }
      this.scheduleAutoAction(result.tableId);
    }
  }

  /**
   * 指定されたテーブルの次のアクションを自動実行するタイマーをスケジュールする
   */
  private scheduleAutoAction(tableId: string): void {
    // 既存のタイマーをクリア
    this.clearAutoActionTimer(tableId);

    // 次のアクションを実行する席番号を取得
    const seatNo = this.tableService.getNextToActSeatNo(tableId);
    if (seatNo === null) {
      return;
    }

    // タイマーをセット
    const timeoutId = this.setTimeoutFn(() => {
      void this.runAutoAction(tableId, seatNo);
    }, this.actionTimeoutMs);
    // タイマーIDを保存
    this.actionTimersByTableId.set(tableId, timeoutId);
  }

  private clearAutoActionTimer(tableId: string): void {
    const existing = this.actionTimersByTableId.get(tableId);
    if (!existing) {
      return;
    }

    this.clearTimeoutFn(existing);
    this.actionTimersByTableId.delete(tableId);
  }

  private async runAutoAction(tableId: string, seatNo: number): Promise<void> {
    this.actionTimersByTableId.delete(tableId);

    const result = await this.tableService.executeAutoAction({
      tableId,
      seatNo,
      occurredAt: this.now(),
    });

    if (result.ok) {
      for (const event of result.events) {
        this.broadcastToTable(result.tableId, event);
      }
      this.scheduleAutoAction(result.tableId);
    }
  }

  private parseJsonCommand(
    text: string,
    connection: TrackedConnection,
    commandContext: ClientCommandContext,
    occurredAt: Date,
  ): JsonCommandParseResult {
    try {
      return {
        ok: true,
        value: JSON.parse(text),
      };
    } catch {
      this.sendTableError({
        connection,
        code: RealtimeErrorCodeMap.INVALID_ACTION,
        message: "JSON形式が不正です。",
        occurredAt,
        context: commandContext,
      });

      return { ok: false };
    }
  }

  private validateCommand(
    input: unknown,
    connection: TrackedConnection,
    commandContext: ClientCommandContext,
    occurredAt: Date,
  ) {
    try {
      const baseCommand = validateWsBaseCommand(input);
      commandContext.requestId = baseCommand.requestId;
      commandContext.tableId = resolveTableIdFromPayload(baseCommand.payload);
      return baseCommand;
    } catch {
      this.sendTableError({
        connection,
        code: RealtimeErrorCodeMap.INVALID_ACTION,
        message: "WebSocketコマンド形式が不正です。",
        occurredAt,
        context: commandContext,
      });
      return null;
    }
  }

  private sendTableError(params: {
    connection: TrackedConnection;
    code: RealtimeErrorCode;
    message: string;
    occurredAt: Date;
    context: ClientCommandContext;
  }): void {
    params.connection.socket.send(
      JSON.stringify(
        buildErrorPayload({
          code: params.code,
          message: params.message,
          occurredAt: params.occurredAt,
          context: params.context,
        }),
      ),
    );
  }

  /**
   * 指定されたテーブルに接続している全クライアントにイベントをブロードキャストする
   */
  private broadcastToTable(
    tableId: string,
    event: unknown,
    commandUser?: SessionUser,
  ): void {
    const body = JSON.stringify(event);

    // テーブルに接続している全クライアントに送信
    for (const connection of this.connections) {
      if (connection.currentTableId === tableId) {
        connection.socket.send(body);
      }
    }

    if (!commandUser) {
      return;
    }

    // コマンド発行者がテーブルに接続しているか確認
    const connectedInTable = [...this.connections].some(
      (connection) =>
        connection.currentTableId === tableId &&
        getSessionIdFromCookie(connection.request.headers.cookie) !== null,
    );

    // 発行者がテーブルに接続していない場合、発行者にのみ送信
    if (!connectedInTable) {
      // 発行者だけでも受信できるよう、未購読時は no-op を避ける。
      for (const connection of this.connections) {
        const sessionId = getSessionIdFromCookie(
          connection.request.headers.cookie,
        );
        if (!sessionId) {
          continue;
        }

        const session = this.sessionStore.findById(sessionId, this.now());
        if (session && session.user.userId === commandUser.userId) {
          connection.currentTableId = tableId;
          connection.socket.send(body);
        }
      }
    }
  }
}

export const createWsGateway = (options: WsGatewayOptions): WsGateway =>
  new WsGateway(options);

import type { TableDetailRecord } from "../../table-detail";

export interface TableDetailRepository {
  getById(tableId: string): Promise<TableDetailRecord | null>;
}

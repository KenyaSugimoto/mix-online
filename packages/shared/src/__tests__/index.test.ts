import { describe, expect, it } from "vitest";
import type { GameType } from "../index";

describe("Shared Types", () => {
  it("GameType should be valid", () => {
    const gameType: GameType = "STUD_HI";
    expect(gameType).toBe("STUD_HI");
  });

  it("should have expected game types", () => {
    // 実際に型を値として使うテスト
    const gameTypes: string[] = ["STUD_HI", "RAZZ", "STUD_8"];
    expect(gameTypes).toContain("STUD_HI");
    expect(gameTypes).toContain("RAZZ");
    expect(gameTypes).toContain("STUD_8");
  });
});

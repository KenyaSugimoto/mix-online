import type { GameType } from "@mix-online/shared";

export function App() {
  const gameTypes: GameType[] = ["STUD_HI", "RAZZ", "STUD_8"];

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
      <h1>🃏 Mix Stud Online</h1>
      <p>Welcome to Mix Stud Online!</p>
      <h2>対象ゲーム</h2>
      <ul>
        {gameTypes.map((game) => (
          <li key={game}>{game}</li>
        ))}
      </ul>
    </div>
  );
}

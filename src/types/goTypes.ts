export type Player = 0 | 1 | 2; // 0 = empty, 1 = black, 2 = white
export type BoardSize = 9 | 13 | 19;

export interface GameMove {
  player: Player;
  row: number;
  col: number;
  timestamp: number;
  captures: number;
  isPass?: boolean;
}

export interface Territory {
  points: [number, number][];
  owner: Player; // 0 = neutral
}

export interface GameScore {
  blackScore: number;
  whiteScore: number;
  blackTerritory: number;
  whiteTerritory: number;
}

export interface GameState {
  board: Player[][];
  currentPlayer: Player;
  blackCaptures: number;
  whiteCaptures: number;
  moveHistory: GameMove[];
  passCount: number;
  gameStatus: 'Playing' | 'Finished';
  koPosition: { row: number; col: number } | null;
}

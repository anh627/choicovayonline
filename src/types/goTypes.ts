export interface GameMove {
  player: number;
  row: number;
  col: number;
  timestamp: number;
  captures: number;
  isPass?: boolean;
}

export interface Territory {
  points: [number, number][];
  owner: number; // 0 = neutral, 1 = black, 2 = white
}

export interface GameScore {
  blackScore: number;
  whiteScore: number;
  blackTerritory: number;
  whiteTerritory: number;
}

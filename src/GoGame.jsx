import React, { useEffect, useState } from "react";

// ---- Types & Constants ----

type Stone = 0 | 1 | 2; // 0 empty, 1 black, 2 white

type Route = "menu" | "ai" | "local";

interface Position {
  x: number;
  y: number;
}

interface Captures {
  black: number; // stones captured by black
  white: number; // stones captured by white
}

interface Summary {
  mode: "ai" | "local";
  blackScore: number;
  whiteScore: number;
  captures: Captures;
  komi: number;
  winner: "black" | "white" | "draw";
}

const BOARD_SIZE = 9;
const DEFAULT_KOMI = 5.5;

// ---- Utility functions ----

function makeEmptyBoard(): Stone[][] {
  return Array.from({ length: BOARD_SIZE }, () => Array<Stone>(BOARD_SIZE).fill(0));
}

function cloneBoard(board: Stone[][]): Stone[][] {
  return board.map((row) => row.slice() as Stone[]);
}

function inBounds(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < BOARD_SIZE && y < BOARD_SIZE;
}

function neighbors(x: number, y: number): Position[] {
  const dirs = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ];
  const res: Position[] = [];
  for (const d of dirs) {
    const nx = x + d.x;
    const ny = y + d.y;
    if (inBounds(nx, ny)) res.push({ x: nx, y: ny });
  }
  return res;
}

function getGroupAndLiberties(board: Stone[][], x: number, y: number): { group: Position[]; liberties: Set<string> } {
  const color = board[y][x];
  const visited = new Set<string>();
  const liberties = new Set<string>();
  const group: Position[] = [];
  if (color === 0) return { group, liberties };
  const key = (px: number, py: number) => `${px},${py}`;
  const stack: Position[] = [{ x, y }];
  visited.add(key(x, y));
  while (stack.length) {
    const cur = stack.pop()!;
    group.push(cur);
    for (const n of neighbors(cur.x, cur.y)) {
      const cell = board[n.y][n.x];
      if (cell === 0) {
        liberties.add(key(n.x, n.y));
      } else if (cell === color) {
        const k = key(n.x, n.y);
        if (!visited.has(k)) {
          visited.add(k);
          stack.push(n);
        }
      }
    }
  }
  return { group, liberties };
}

function removeGroup(board: Stone[][], group: Position[]): number {
  let removed = 0;
  for (const p of group) {
    if (board[p.y][p.x] !== 0) {
      board[p.y][p.x] = 0;
      removed++;
    }
  }
  return removed;
}

function tryPlay(board: Stone[][], x: number, y: number, color: Stone): { legal: boolean; board?: Stone[][]; captured?: number } {
  if (board[y][x] !== 0) return { legal: false };
  const test = cloneBoard(board);
  test[y][x] = color;
  const opponent: Stone = color === 1 ? 2 : 1;
  let captured = 0;
  // Capture opponent groups with no liberties
  for (const n of neighbors(x, y)) {
    if (test[n.y][n.x] === opponent) {
      const { group, liberties } = getGroupAndLiberties(test, n.x, n.y);
      if (liberties.size === 0) {
        captured += removeGroup(test, group);
      }
    }
  }
  // Check if our placed group has liberties (suicide check)
  const { liberties } = getGroupAndLiberties(test, x, y);
  if (liberties.size === 0 && captured === 0) {
    return { legal: false };
  }
  return { legal: true, board: test, captured };
}

function countStones(board: Stone[][]): { black: number; white: number } {
  let black = 0;
  let white = 0;
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (board[y][x] === 1) black++;
      if (board[y][x] === 2) white++;
    }
  }
  return { black, white };
}

function computeScore(board: Stone[][], captures: Captures, komi: number): { blackScore: number; whiteScore: number } {
  const stones = countStones(board);
  const blackScore = stones.black + captures.black;
  const whiteScore = stones.white + captures.white + komi;
  return { blackScore, whiteScore };
}

function prettyColor(color: Stone): string {
  return color === 1 ? "Đen" : color === 2 ? "Trắng" : "";
}

// ---- UI Components ----

function ModeModal({
  open,
  onSelect,
  onClose,
  summary,
}: {
  open: boolean;
  onSelect: (mode: "ai" | "local") => void;
  onClose: () => void;
  summary: Summary | null;
}) {
  if (!open) return null;
  const winnerText = summary
    ? summary.winner === "draw"
      ? "Hòa"
      : summary.winner === "black"
      ? "Đen thắng"
      : "Trắng thắng"
    : null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-3xl rounded-xl bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Chọn chế độ</h2>
          <button onClick={onClose} className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50">Đóng</button>
        </div>
        {summary && (
          <div className="mb-4 rounded-lg border p-4">
            <div className="mb-2 text-sm font-medium text-gray-700">Kết quả ván trước ({summary.mode === "ai" ? "Chơi với máy" : "Chơi 2 người"})</div>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span className="rounded bg-gray-100 px-2 py-1">{winnerText}</span>
              <span>Đen: {summary.blackScore.toFixed(1)}</span>
              <span>Trắng: {summary.whiteScore.toFixed(1)} (komi {summary.komi})</span>
              <span>Bắt: Đen {summary.captures.black}, Trắng {summary.captures.white}</span>
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <button
            onClick={() => onSelect("ai")}
            className="flex items-center gap-4 rounded-lg border p-4 text-left hover:shadow focus:outline-none focus:ring"
          >
            <div className="bg-gray-200 border-2 border-dashed rounded-xl w-16 h-16" />
            <div>
              <div className="font-medium">Chơi với máy</div>
              <div className="text-sm text-gray-600">Đối thủ máy cơ bản, phù hợp để làm quen.</div>
            </div>
          </button>
          <button
            onClick={() => onSelect("local")}
            className="flex items-center gap-4 rounded-lg border p-4 text-left hover:shadow focus:outline-none focus:ring"
          >
            <div className="bg-gray-200 border-2 border-dashed rounded-xl w-16 h-16" />
            <div>
              <div className="font-medium">Chơi 2 người</div>
              <div className="text-sm text-gray-600">Cùng chơi trên một máy, luân phiên đi quân.</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

function GoBoard({
  board,
  lastMove,
  onPlay,
  disabled,
}: {
  board: Stone[][];
  lastMove: Position | null;
  onPlay: (x: number, y: number) => void;
  disabled?: boolean;
}) {
  const isStar = (x: number, y: number) => {
    // Standard star points for 9x9: (2,2), (2,6), (6,2), (6,6), (4,4) [0-based]
    if (BOARD_SIZE !== 9) return false;
    const pts = [
      { x: 2, y: 2 },
      { x: 6, y: 2 },
      { x: 2, y: 6 },
      { x: 6, y: 6 },
      { x: 4, y: 4 },
    ];
    return pts.some((p) => p.x === x && p.y === y);
  };

  return (
    <div className="inline-block rounded-lg border bg-yellow-100 p-2">
      <div className="grid grid-cols-9">
        {board.map((row, y) =>
          row.map((cell, x) => {
            const isLast = lastMove && lastMove.x === x && lastMove.y === y;
            const baseBorders = [
              y === 0 ? "border-t" : "",
              x === 0 ? "border-l" : "",
              y === BOARD_SIZE - 1 ? "border-b" : "",
              x === BOARD_SIZE - 1 ? "border-r" : "",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <button
                key={`${x}-${y}`}
                onClick={() => onPlay(x, y)}
                disabled={disabled}
                className={`relative flex h-10 w-10 items-center justify-center ${baseBorders} border-yellow-700 bg-yellow-100 hover:bg-yellow-200 ${
                  disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer"
                }`}
                aria-label={`Ô (${x + 1},${y + 1})`}
                title={`Ô (${x + 1},${y + 1})`}
              >
                {isStar(x, y) && cell === 0 && (
                  <div className="h-2 w-2 rounded-full bg-yellow-700" />
                )}
                {cell !== 0 && (
                  <div
                    className={`h-7 w-7 rounded-full ${
                      cell === 1
                        ? "bg-black shadow"
                        : "bg-white shadow border border-gray-400"
                    } ${isLast ? "ring-2 ring-blue-400" : ""}`}
                  />
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function ScoreBar({
  current,
  captures,
  komi,
}: {
  current: Stone;
  captures: Captures;
  komi: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600">Lượt:</span>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm ${
            current === 1 ? "bg-black text-white" : "bg-white text-gray-900 border"
          }`}
        >
          {prettyColor(current)}
        </span>
      </div>
      <div className="text-sm text-gray-700">Bắt: Đen {captures.black} · Trắng {captures.white}</div>
      <div className="text-sm text-gray-700">Komi: {komi}</div>
    </div>
  );
}

// ---- Game Modes ----

function AiGame({
  onRequestMode,
  reportFinish,
}: {
  onRequestMode: () => void;
  reportFinish: (summary: Summary) => void;
}) {
  const [board, setBoard] = useState<Stone[][]>(() => makeEmptyBoard());
  const [current, setCurrent] = useState<Stone>(1); // black starts
  const [captures, setCaptures] = useState<Captures>({ black: 0, white: 0 });
  const [lastMove, setLastMove] = useState<Position | null>(null);
  const [passes, setPasses] = useState(0);
  const [humanColor, setHumanColor] = useState<Stone>(1);
  const [message, setMessage] = useState<string>("");
  const komi = DEFAULT_KOMI;

  const moveCount = countStones(board).black + countStones(board).white;
  const canToggleColor = moveCount === 0;

  function endGame(reason: string) {
    const { blackScore, whiteScore } = computeScore(board, captures, komi);
    const winner: "black" | "white" | "draw" =
      Math.abs(blackScore - whiteScore) < 1e-6
        ? "draw"
        : blackScore > whiteScore
        ? "black"
        : "white";
    reportFinish({
      mode: "ai",
      blackScore,
      whiteScore,
      captures,
      komi,
      winner,
    });
    setMessage(reason ? `Kết thúc: ${reason}` : "");
  }

  function handleHumanPlay(x: number, y: number) {
    if (current !== humanColor) return;
    const res = tryPlay(board, x, y, current);
    if (!res.legal || !res.board) {
      setMessage("Nước đi không hợp lệ");
      return;
    }
    setBoard(res.board);
    setLastMove({ x, y });
    setPasses(0);
    if (current === 1 && res.captured) {
      setCaptures((c) => ({ ...c, black: c.black + (res.captured || 0) }));
    }
    if (current === 2 && res.captured) {
      setCaptures((c) => ({ ...c, white: c.white + (res.captured || 0) }));
    }
    setCurrent(current === 1 ? 2 : 1);
  }

  function pickAiMove(): { x: number; y: number } | null {
    // Evaluate legal moves with simple heuristic
    const center = { x: Math.floor(BOARD_SIZE / 2), y: Math.floor(BOARD_SIZE / 2) };
    type Candidate = { x: number; y: number; score: number };
    const candidates: Candidate[] = [];
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        const trial = tryPlay(board, x, y, current);
        if (trial.legal) {
          const dx = Math.abs(center.x - x);
          const dy = Math.abs(center.y - y);
          const dist = dx + dy;
          const captured = trial.captured || 0;
          const nearLast = lastMove && (Math.abs(lastMove.x - x) + Math.abs(lastMove.y - y) === 1) ? 1 : 0;
          const score = captured * 10 - dist + nearLast;
          candidates.push({ x, y, score });
        }
      }
    }
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => b.score - a.score);
    const take = Math.max(1, Math.min(3, candidates.length));
    const idx = Math.floor(Math.random() * take);
    return { x: candidates[idx].x, y: candidates[idx].y };
  }

  // AI turn effect
  useEffect(() => {
    if (current === humanColor) return; // wait for AI turn
    // AI move immediately (no delay for simplicity and stability)
    const move = pickAiMove();
    if (move) {
      const res = tryPlay(board, move.x, move.y, current);
      if (res.legal && res.board) {
        setBoard(res.board);
        setLastMove({ x: move.x, y: move.y });
        setPasses(0);
        if (current === 1 && res.captured) {
          setCaptures((c) => ({ ...c, black: c.black + (res.captured || 0) }));
        }
        if (current === 2 && res.captured) {
          setCaptures((c) => ({ ...c, white: c.white + (res.captured || 0) }));
        }
      }
      setCurrent(current === 1 ? 2 : 1);
    } else {
      // AI passes
      setPasses((p) => {
        const next = p + 1;
        if (next >= 2) {
          endGame("Cả hai đã pass");
        } else {
          setCurrent(current === 1 ? 2 : 1);
        }
        return next;
      });
      setMessage("Máy pass");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  function handlePass() {
    if (current !== humanColor) return;
    setPasses((p) => {
      const next = p + 1;
      if (next >= 2) {
        endGame("Cả hai đã pass");
      } else {
        setCurrent(current === 1 ? 2 : 1);
      }
      return next;
    });
  }

  function handleEndEarly() {
    endGame("Kết thúc sớm");
  }

  function handleRestartSameMode() {
    setBoard(makeEmptyBoard());
    setCurrent(1);
    setCaptures({ black: 0, white: 0 });
    setLastMove(null);
    setPasses(0);
    setMessage("");
  }

  function toggleHumanColor() {
    if (!canToggleColor) return;
    setHumanColor((c) => (c === 1 ? 2 : 1));
    setCurrent(1); // reset turn to black after toggle when no moves have been played
  }

  return (
    <div className="mx-auto max-w-5xl p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Chế độ: Chơi với máy</h1>
          <p className="text-sm text-gray-600">Bàn 9x9, luật bắt quân cơ bản (suicide bị cấm trừ khi bắt).</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onRequestMode} className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50">Chọn chế độ</button>
          <button onClick={handleRestartSameMode} className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50">Chơi lại</button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <ScoreBar current={current} captures={captures} komi={komi} />
        <div className="flex items-center gap-2 rounded-lg border p-2 text-sm">
          <span className="text-gray-600">Bạn:</span>
          <button
            onClick={toggleHumanColor}
            className={`rounded-full px-3 py-1 ${
              humanColor === 1 ? "bg-black text-white" : "bg-white text-gray-900 border"
            } ${canToggleColor ? "" : "opacity-60 cursor-not-allowed"}`}
            disabled={!canToggleColor}
            title={canToggleColor ? "Đổi bên trước khi bắt đầu" : "Chỉ đổi khi chưa đi quân"}
          >
            {prettyColor(humanColor)}
          </button>
        </div>
      </div>

      <div className="flex flex-col items-center gap-4">
        <GoBoard board={board} lastMove={lastMove} onPlay={handleHumanPlay} />
        <div className="flex items-center gap-2">
          <button onClick={handlePass} className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50">Pass</button>
          <button onClick={handleEndEarly} className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50">Kết thúc ván</button>
        </div>
        {message && <div className="text-sm text-gray-600">{message}</div>}
      </div>
    </div>
  );
}

function LocalGame({
  onRequestMode,
  reportFinish,
}: {
  onRequestMode: () => void;
  reportFinish: (summary: Summary) => void;
}) {
  const [board, setBoard] = useState<Stone[][]>(() => makeEmptyBoard());
  const [current, setCurrent] = useState<Stone>(1);
  const [captures, setCaptures] = useState<Captures>({ black: 0, white: 0 });
  const [lastMove, setLastMove] = useState<Position | null>(null);
  const [passes, setPasses] = useState(0);
  const komi = DEFAULT_KOMI;

  function endGame(reason: string) {
    const { blackScore, whiteScore } = computeScore(board, captures, komi);
    const winner: "black" | "white" | "draw" =
      Math.abs(blackScore - whiteScore) < 1e-6
        ? "draw"
        : blackScore > whiteScore
        ? "black"
        : "white";
    reportFinish({ mode: "local", blackScore, whiteScore, captures, komi, winner });
  }

  function handlePlay(x: number, y: number) {
    const res = tryPlay(board, x, y, current);
    if (!res.legal || !res.board) return;
    setBoard(res.board);
    setLastMove({ x, y });
    setPasses(0);
    if (current === 1 && res.captured) setCaptures((c) => ({ ...c, black: c.black + (res.captured || 0) }));
    if (current === 2 && res.captured) setCaptures((c) => ({ ...c, white: c.white + (res.captured || 0) }));
    setCurrent(current === 1 ? 2 : 1);
  }

  function handlePass() {
    setPasses((p) => {
      const next = p + 1;
      if (next >= 2) {
        endGame("Cả hai đã pass");
      } else {
        setCurrent(current === 1 ? 2 : 1);
      }
      return next;
    });
  }

  function handleEndEarly() {
    endGame("Kết thúc sớm");
  }

  function handleRestart() {
    setBoard(makeEmptyBoard());
    setCurrent(1);
    setCaptures({ black: 0, white: 0 });
    setLastMove(null);
    setPasses(0);
  }

  return (
    <div className="mx-auto max-w-5xl p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Chế độ: Chơi 2 người</h1>
          <p className="text-sm text-gray-600">Luân phiên đi quân, bàn 9x9, luật bắt quân cơ bản.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onRequestMode} className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50">Chọn chế độ</button>
          <button onClick={handleRestart} className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50">Chơi lại</button>
        </div>
      </div>

      <div className="mb-3">
        <ScoreBar current={current} captures={captures} komi={komi} />
      </div>

      <div className="flex flex-col items-center gap-4">
        <GoBoard board={board} lastMove={lastMove} onPlay={handlePlay} />
        <div className="flex items-center gap-2">
          <button onClick={handlePass} className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50">Pass</button>
          <button onClick={handleEndEarly} className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50">Kết thúc ván</button>
        </div>
      </div>
    </div>
  );
}

// ---- Page ----

export default function IndexPage() {
  const [route, setRoute] = useState<Route>("menu");
  const [modeOpen, setModeOpen] = useState<boolean>(true); // show at start
  const [sessionKey, setSessionKey] = useState<number>(0);
  const [lastSummary, setLastSummary] = useState<Summary | null>(null);

  function openMode() {
    setModeOpen(true);
  }

  function handleSelect(mode: "ai" | "local") {
    setRoute(mode);
    setSessionKey((k) => k + 1); // force remount to reset game state
    setModeOpen(false);
  }

  function handleGameFinished(summary: Summary) {
    setLastSummary(summary);
    setModeOpen(true); // show mode selector after game ends
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-black" />
            <div>
              <div className="text-base font-semibold">Cờ Vây</div>
              <div className="text-xs text-gray-500">Go Board 9x9</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={openMode} className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50">Chọn chế độ</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-4">
        {route === "menu" && (
          <div className="mx-auto max-w-3xl rounded-xl border bg-white p-6">
            <h1 className="mb-2 text-xl font-semibold">Chào mừng đến với Cờ Vây</h1>
            <p className="mb-4 text-gray-700">Chọn chế độ chơi để bắt đầu — bạn có thể chơi với máy hoặc 2 người trên cùng thiết bị. Bảng chọn chế độ sẽ xuất hiện khi bắt đầu và sau khi kết thúc ván.</p>
            <div className="flex flex-wrap gap-3">
              <button onClick={() => handleSelect("ai")} className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50">Chơi với máy</button>
              <button onClick={() => handleSelect("local")} className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50">Chơi 2 người</button>
            </div>
          </div>
        )}

        {route === "ai" && (
          <AiGame key={`ai-${sessionKey}`} onRequestMode={openMode} reportFinish={handleGameFinished} />
        )}

        {route === "local" && (
          <LocalGame key={`local-${sessionKey}`} onRequestMode={openMode} reportFinish={handleGameFinished} />
        )}
      </main>

      <ModeModal open={modeOpen} onSelect={handleSelect} onClose={() => setModeOpen(false)} summary={lastSummary} />
    </div>
  );
}

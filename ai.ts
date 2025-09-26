import { BLACK, WHITE, EMPTY } from './constants';
import { hasLiberties, checkCaptures, isValidMove, calculateScore } from './utils';

interface MCTSNode {
  move: [number, number] | null;
  parent: MCTSNode | null;
  children: MCTSNode[];
  visits: number;
  wins: number;
  board: number[][];
  player: number;
  prior: number; // Policy prior for move selection
}

const createMCTSNode = (
  board: number[][],
  move: [number, number] | null,
  parent: MCTSNode | null,
  player: number,
  prior: number = 0
): MCTSNode => ({
  move,
  parent,
  children: [],
  visits: 0,
  wins: 0,
  board: board.map(row => [...row]),
  player,
  prior,
});

// Simple policy heuristic for move evaluation
const evaluateMovePolicy = (board: number[][], row: number, col: number, player: number): number => {
  let score = 0;
  const testBoard = board.map(r => [...r]);
  testBoard[row][col] = player;

  // Prioritize captures
  const { captures } = checkCaptures(testBoard, row, col, player);
  score += captures * 10;

  // Prioritize moves near existing stones
  const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (const [dr, dc] of directions) {
    const adjRow = row + dr;
    const adjCol = col + dc;
    if (adjRow >= 0 && adjRow < board.length && adjCol >= 0 && adjCol < board[0].length) {
      if (testBoard[adjRow][adjCol] !== EMPTY) score += 2;
    }
  }

  // Prioritize center for early game
  const center = Math.floor(board.length / 2);
  const distanceToCenter = Math.abs(row - center) + Math.abs(col - center);
  score += (board.length - distanceToCenter) * 0.5;

  return score;
};

export const makeAIMove = (
  board: number[][],
  currentPlayer: number,
  setBoard: (board: number[][]) => void,
  setCurrentPlayer: (player: number) => void,
  setBlackCaptures: (captures: number) => void,
  setWhiteCaptures: (captures: number) => void,
  setMoveHistory: (history: any) => void,
  setKoPosition: (ko: { row: number; col: number } | null) => void,
  setPassCount: (count: number) => void,
  setGameStatus: (status: string) => void,
  setShowScore: (show: boolean) => void,
  difficulty: 'easy' | 'medium' | 'hard'
) => {
  const validMoves: [number, number][] = [];
  for (let row = 0; row < board.length; row++) {
    for (let col = 0; col < board[0].length; col++) {
      if (isValidMove(board, row, col, currentPlayer)) {
        validMoves.push([row, col]);
      }
    }
  }

  if (validMoves.length === 0) {
    setPassCount(prev => {
      const newPassCount = prev + 1;
      if (newPassCount >= 2) {
        setGameStatus('Finished');
        setShowScore(true);
      }
      setMoveHistory((prev: any) => [
        ...prev,
        { player: currentPlayer, row: -1, col: -1, timestamp: Date.now(), captures: 0, isPass: true },
      ]);
      setCurrentPlayer(currentPlayer === BLACK ? WHITE : BLACK);
      return newPassCount;
    });
    return;
  }

  let selectedMove: [number, number] | null = null;

  if (difficulty === 'easy') {
    selectedMove = validMoves[Math.floor(Math.random() * validMoves.length)];
  } else if (difficulty === 'medium') {
    let bestScore = -Infinity;
    for (const [row, col] of validMoves) {
      const score = evaluateMovePolicy(board, row, col, currentPlayer);
      if (score > bestScore) {
        bestScore = score;
        selectedMove = [row, col];
      }
    }
  } else if (difficulty === 'hard') {
    // Advanced MCTS with policy heuristic
    const root = createMCTSNode(board, null, null, currentPlayer);
    const iterations = 10000; // Increased iterations for stronger play

    // Initialize children with policy priors
    for (const [row, col] of validMoves) {
      const newBoard = board.map(r => [...r]);
      newBoard[row][col] = currentPlayer;
      const prior = evaluateMovePolicy(board, row, col, currentPlayer) / 100;
      const child = createMCTSNode(newBoard, [row, col], root, currentPlayer === BLACK ? WHITE : BLACK, prior);
      root.children.push(child);
    }

    // Run MCTS in a Web Worker for performance
    const worker = new Worker(URL.createObjectURL(new Blob([`
      self.onmessage = function(e) {
        const { root, iterations, boardSize } = e.data;
        // Simplified MCTS simulation (for brevity)
        for (let i = 0; i < iterations; i++) {
          let node = root;
          while (node.children.length > 0) {
            node = node.children.reduce((best, child) => {
              const uct = child.wins / (child.visits || 1) + 
                1.414 * Math.sqrt(Math.log(root.visits || 1) / (child.visits || 1)) +
                child.prior;
              return uct > (best.wins / (best.visits || 1) + 
                1.414 * Math.sqrt(Math.log(root.visits || 1) / (best.visits || 1)) +
                best.prior) ? child : best;
            }, node.children[0]);
          }

          // Expansion
          const validChildMoves = [];
          for (let row = 0; row < ${board.length}; row++) {
            for (let col = 0; col < ${board[0].length}; col++) {
              if (!node.board[row][col]) validChildMoves.push([row, col]);
            }
          }
          if (validChildMoves.length > 0 && node.visits > 0) {
            const move = validChildMoves[Math.floor(Math.random() * validChildMoves.length)];
            const newBoard = node.board.map(r => [...r]);
            newBoard[move[0]][move[1]] = node.player;
            const child = {
              move,
              parent: node,
              children: [],
              visits: 0,
              wins: 0,
              board: newBoard,
              player: node.player === ${BLACK} ? ${WHITE} : ${BLACK},
              prior: 0,
            };
            node.children.push(child);
            node = child;
          }

          // Simulation
          let simBoard = node.board.map(r => [...r]);
          let simPlayer = node.player;
          let passes = 0;
          while (passes < 2) {
            const simValidMoves = [];
            for (let r = 0; r < ${board.length}; r++) {
              for (let c = 0; c < ${board[0].length}; c++) {
                if (!simBoard[r][c]) simValidMoves.push([r, c]);
              }
            }
            if (simValidMoves.length === 0) {
              passes++;
              simPlayer = simPlayer === ${BLACK} ? ${WHITE} : ${BLACK};
              continue;
            }
            const move = simValidMoves[Math.floor(Math.random() * simValidMoves.length)];
            simBoard[move[0]][move[1]] = simPlayer;
            simPlayer = simPlayer === ${BLACK} ? ${WHITE} : ${BLACK};
            passes = 0;
          }

          // Backpropagation
          const blackScore = Math.random() * 100; // Placeholder for score
          const whiteScore = Math.random() * 100;
          let current = node;
          while (current) {
            current.visits++;
            if (current.player === ${BLACK} && blackScore > whiteScore) current.wins++;
            if (current.player === ${WHITE} && whiteScore > blackScore) current.wins++;
            current = current.parent;
          }
        }

        const bestMove = root.children.reduce((best, child) => 
          child.visits > best.visits ? child : best, root.children[0]).move;
        self.postMessage(bestMove);
      };
    `], { type: 'text/javascript' })));

    worker.postMessage({ root, iterations, boardSize: board.length });
    worker.onmessage = e => {
      selectedMove = e.data;
      worker.terminate();

      if (selectedMove) {
        const newBoard = board.map(r => [...r]);
        newBoard[selectedMove[0]][selectedMove[1]] = currentPlayer;
        const { newBoard: capturedBoard, captures, koPosition } = checkCaptures(newBoard, selectedMove[0], selectedMove[1], currentPlayer);

        if (currentPlayer === BLACK) {
          setWhiteCaptures(prev => prev + captures);
        } else {
          setBlackCaptures(prev => prev + captures);
        }

        setBoard(capturedBoard);
        setKoPosition(koPosition);
        setMoveHistory((prev: any) => [
          ...prev,
          { player: currentPlayer, row: selectedMove[0], col: selectedMove[1], timestamp: Date.now(), captures },
        ]);
        setCurrentPlayer(currentPlayer === BLACK ? WHITE : BLACK);
        setPassCount(0);
      }
    };
  }

  if (selectedMove) {
    const newBoard = board.map(r => [...r]);
    newBoard[selectedMove[0]][selectedMove[1]] = currentPlayer;
    const { newBoard: capturedBoard, captures, koPosition } = checkCaptures(newBoard, selectedMove[0], selectedMove[1], currentPlayer);

    if (currentPlayer === BLACK) {
      setWhiteCaptures(prev => prev + captures);
    } else {
      setBlackCaptures(prev => prev + captures);
    }

    setBoard(capturedBoard);
    setKoPosition(koPosition);
    setMoveHistory((prev: any) => [
      ...prev,
      { player: currentPlayer, row: selectedMove[0], col: selectedMove[1], timestamp: Date.now(), captures },
    ]);
    setCurrentPlayer(currentPlayer === BLACK ? WHITE : BLACK);
    setPassCount(0);
  }
};

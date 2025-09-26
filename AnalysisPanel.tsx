import React from 'react';
import { evaluateMovePolicy } from './ai';
import { BLACK, WHITE } from './constants';

interface AnalysisPanelProps {
  board: number[][];
  moveHistory: any[];
  currentPlayer: number;
}

const AnalysisPanel: React.FC<AnalysisPanelProps> = ({ board, moveHistory, currentPlayer }) => {
  const getBestMoves = () => {
    const validMoves: [number, number, number][] = [];
    for (let row = 0; row < board.length; row++) {
      for (let col = 0; col < board[0].length; col++) {
        if (board[row][col] === 0) {
          const score = evaluateMovePolicy(board, row, col, currentPlayer);
          validMoves.push([row, col, score]);
        }
      }
    }
    return validMoves.sort((a, b) => b[2] - a[2]).slice(0, 3);
  };

  const bestMoves = getBestMoves();

  return (
    <div className="bg-gray-50 p-6 rounded-lg shadow mb-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-4">Move Analysis</h2>
      <div className="space-y-2">
        <p className="text-sm text-gray-600">Top 3 suggested moves for {currentPlayer === BLACK ? 'Black' : 'White'}:</p>
        {bestMoves.length > 0 ? (
          <ul className="space-y-1">
            {bestMoves.map(([row, col, score], index) => (
              <li key={index} className="text-sm">
                {String.fromCharCode(65 + col)}{board.length - row}: Score {score.toFixed(2)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">No valid moves available</p>
        )}
      </div>
    </div>
  );
};

export default AnalysisPanel;

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import styles from './CoVay.module.css';

// Kích thước bàn cờ hỗ trợ: 9x9 (tiêu chuẩn ván nhanh) và 13x13 (bán chuyên)
const BOARD_SIZES = [
  { label: '9x9 (Tốc chiến)', size: 9, komi: 5.5, hoshi: [[2, 2], [2, 6], [6, 2], [6, 6], [4, 4]] },
  { label: '13x13 (Chiến thuật)', size: 13, komi: 6.5, hoshi: [[3, 3], [3, 9], [9, 3], [9, 9], [6, 6]] },
];

export default function CoVay() {
  const [boardSizeIdx, setBoardSizeIdx] = useState(0); // Mặc định 9x9
  const currentConfig = BOARD_SIZES[boardSizeIdx];
  const N = currentConfig.size;
  const komi = currentConfig.komi;

  // Bàn cờ: mảng 2D NxN, giá trị: null | 'B' | 'W'
  const [board, setBoard] = useState(() => Array(N).fill(null).map(() => Array(N).fill(null)));
  const [turn, setTurn] = useState('B'); // 'B' = Đen đi trước, 'W' = Trắng
  const [captured, setCaptured] = useState({ B: 0, W: 0 }); // Số tù binh mà B và W đã bắt
  const [history, setHistory] = useState([]); // Lưu lịch sử bàn cờ để Undo
  const [lastMove, setLastMove] = useState(null); // [r, c]

  // LUẬT KIẾP (KO RULE): Tọa độ [r, c] bị cấm đặt quân trong lượt hiện tại
  const [koPoint, setKoPoint] = useState(null);

  // LUẬT PASS & KẾT THÚC: Nếu 2 bên liên tiếp Pass -> Kết thúc ván và đếm mục
  const [consecutivePasses, setConsecutivePasses] = useState(0);
  const [gameResult, setGameResult] = useState(null); // { winner, scoreB, scoreW, margin, reason }

  // CHẾ ĐỘ CHƠI
  const [gameMode, setGameMode] = useState('ai'); // 'ai' hoặc 'pvp'
  const [aiColor, setAiColor] = useState('W'); // AI cầm quân Trắng (đi sau nhận Komi)
  const [isAiThinking, setIsAiThinking] = useState(false);

  // Khởi tạo lại khi đổi kích thước bàn
  useEffect(() => {
    resetGame(boardSizeIdx);
  }, [boardSizeIdx]);

  function resetGame(sizeIdx = boardSizeIdx) {
    const size = BOARD_SIZES[sizeIdx].size;
    setBoard(Array(size).fill(null).map(() => Array(size).fill(null)));
    setTurn('B');
    setCaptured({ B: 0, W: 0 });
    setHistory([]);
    setLastMove(null);
    setKoPoint(null);
    setConsecutivePasses(0);
    setGameResult(null);
    setIsAiThinking(false);
  }

  // --- THUẬT TOÁN TÍNH KHÍ VÀ TÙ BINH (LIBERTIES & CAPTURING) ---
  const getNeighbors = useCallback((r, c, size = N) => {
    const list = [];
    if (r > 0) list.push([r - 1, c]);
    if (r < size - 1) list.push([r + 1, c]);
    if (c > 0) list.push([r, c - 1]);
    if (c < size - 1) list.push([r, c + 1]);
    return list;
  }, [N]);

  // Tìm cụm quân (group) liên kết và số lượng khí (liberties)
  const getGroupAndLiberties = useCallback((b, startR, startC) => {
    const color = b[startR][startC];
    if (!color) return { stones: [], liberties: new Set() };

    const visited = new Set();
    const stones = [];
    const liberties = new Set();
    const queue = [[startR, startC]];
    visited.add(`${startR},${startC}`);

    while (queue.length > 0) {
      const [r, c] = queue.shift();
      stones.push([r, c]);

      const neighbors = getNeighbors(r, c, b.length);
      for (const [nr, nc] of neighbors) {
        const val = b[nr][nc];
        if (val === null) {
          liberties.add(`${nr},${nc}`);
        } else if (val === color && !visited.has(`${nr},${nc}`)) {
          visited.add(`${nr},${nc}`);
          queue.push([nr, nc]);
        }
      }
    }

    return { stones, liberties };
  }, [getNeighbors]);

  // Thử nước đi: Kiểm tra xem có hợp lệ (Luật cấm tự sát, Luật Kiếp Ko)
  // Trả về { valid: boolean, newBoard, capturedStones, nextKoPoint }
  const evaluateMove = useCallback((currentBoard, r, c, playerColor, activeKo) => {
    // 1. Ô đã có quân -> Không hợp lệ
    if (currentBoard[r][c] !== null) return { valid: false };

    // 2. Vi phạm Luật Kiếp (Ko Rule) -> Không được đánh vào ô Kiếp tức thì
    if (activeKo && activeKo[0] === r && activeKo[1] === c) {
      return { valid: false, reason: 'Luật Kiếp (Ko): Cấm ăn lại tức thì để tránh vòng lặp bất tận!' };
    }

    // Tạo bản sao thử nghiệm
    const newBoard = currentBoard.map(row => [...row]);
    newBoard[r][c] = playerColor;
    const opponent = playerColor === 'B' ? 'W' : 'B';

    // 3. Kiểm tra các nhóm quân địch kề cận xem có bị triệt tiêu hết khí (bị bắt) không
    const neighbors = getNeighbors(r, c, newBoard.length);
    let capturedStones = [];
    const checkedEnemyGroups = new Set();

    for (const [nr, nc] of neighbors) {
      if (newBoard[nr][nc] === opponent && !checkedEnemyGroups.has(`${nr},${nc}`)) {
        const enemyGroup = getGroupAndLiberties(newBoard, nr, nc);
        enemyGroup.stones.forEach(([er, ec]) => checkedEnemyGroups.add(`${er},${ec}`));

        // Nếu nhóm địch không còn khí nào -> Bị bắt làm tù binh
        if (enemyGroup.liberties.size === 0) {
          capturedStones.push(...enemyGroup.stones);
        }
      }
    }

    // Nhấc các quân địch bị bắt ra khỏi bàn cờ
    for (const [cr, cc] of capturedStones) {
      newBoard[cr][cc] = null;
    }

    // 4. LUẬT CẤM TỰ SÁT (SUICIDE RULE):
    // Sau khi loại quân bắt (nếu có), nhóm quân vừa hạ có còn ít nhất 1 khí không?
    const selfGroup = getGroupAndLiberties(newBoard, r, c);
    if (selfGroup.liberties.size === 0) {
      // Tự sát không bắt được ai -> Hoàn toàn bất hợp lệ
      return { valid: false, reason: 'Luật Cấm Tự Sát: Nước đi tự làm nhóm mình hết khí mà không ăn được quân địch!' };
    }

    // 5. XÁC ĐỊNH ĐIỂM KIẾP TIẾP THEO (KO DETECTION):
    // Nếu nước đi vừa bắt ĐÚNG 1 quân địch, và nhóm vừa đánh CHỈ CÓ 1 quân và CHỈ CÒN 1 khí
    // thì ô quân địch vừa bị bắt biến thành điểm CẤM KIẾP cho bên kia ở nước kế tiếp.
    let nextKoPoint = null;
    if (capturedStones.length === 1 && selfGroup.stones.length === 1 && selfGroup.liberties.size === 1) {
      nextKoPoint = [capturedStones[0][0], capturedStones[0][1]];
    }

    return {
      valid: true,
      newBoard,
      capturedStones,
      nextKoPoint,
    };
  }, [getNeighbors, getGroupAndLiberties]);

  // --- THUẬT TOÁN ĐẾM ĐẤT THEO LUẬT QUỐC TẾ (CHINESE/JAPANESE TERRITORY SCORING) ---
  const calculateFinalScore = useCallback((finalBoard, finalCaptured, currentKomi) => {
    const size = finalBoard.length;
    const visited = Array(size).fill(false).map(() => Array(size).fill(false));
    let blackTerritory = 0;
    let whiteTerritory = 0;
    const territoryMap = Array(size).fill(null).map(() => Array(size).fill(null));

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (finalBoard[r][c] === null && !visited[r][c]) {
          // Khảo sát vùng đất trống liền kề bằng BFS
          const queue = [[r, c]];
          visited[r][c] = true;
          const emptyPoints = [[r, c]];
          let touchesBlack = false;
          let touchesWhite = false;

          while (queue.length > 0) {
            const [qr, qc] = queue.shift();
            const neighbors = getNeighbors(qr, qc, size);

            for (const [nr, nc] of neighbors) {
              const val = finalBoard[nr][nc];
              if (val === 'B') touchesBlack = true;
              else if (val === 'W') touchesWhite = true;
              else if (val === null && !visited[nr][nc]) {
                visited[nr][nc] = true;
                queue.push([nr, nc]);
                emptyPoints.push([nr, nc]);
              }
            }
          }

          // Phân định chủ sở hữu vùng đất
          if (touchesBlack && !touchesWhite) {
            blackTerritory += emptyPoints.length;
            emptyPoints.forEach(([er, ec]) => (territoryMap[er][ec] = 'B'));
          } else if (touchesWhite && !touchesBlack) {
            whiteTerritory += emptyPoints.length;
            emptyPoints.forEach(([er, ec]) => (territoryMap[er][ec] = 'W'));
          }
          // Nếu chạm cả 2 (Đất tranh chấp / Dame) -> 0 điểm
        }
      }
    }

    // Tổng điểm = Đất kiểm soát + Số tù binh đã bắt (+ Komi cho Trắng)
    const scoreB = blackTerritory + finalCaptured.B;
    const scoreW = whiteTerritory + finalCaptured.W + currentKomi;
    const margin = Math.abs(scoreB - scoreW).toFixed(1);
    const winner = scoreB > scoreW ? 'Đen (Black)' : 'Trắng (White)';

    return {
      winner,
      scoreB,
      scoreW,
      blackTerritory,
      whiteTerritory,
      margin,
      komi: currentKomi,
      territoryMap,
    };
  }, [getNeighbors]);

  // XỬ LÝ NƯỚC ĐI CỦA NGƯỜI CHƠI
  const handleCellClick = (r, c) => {
    if (gameResult) return;
    if (gameMode === 'ai' && turn === aiColor) return; // Đang đợi AI

    const result = evaluateMove(board, r, c, turn, koPoint);
    if (!result.valid) {
      if (result.reason) alert(result.reason);
      return;
    }

    applyMove(r, c, result);
  };

  const applyMove = (r, c, result) => {
    // Lưu lịch sử để có thể hoàn tác
    setHistory(prev => [
      ...prev,
      {
        board: board.map(row => [...row]),
        turn,
        captured: { ...captured },
        koPoint,
        lastMove,
        consecutivePasses,
      },
    ]);

    // Cập nhật trạng thái
    setBoard(result.newBoard);
    setCaptured(prev => ({
      ...prev,
      [turn]: prev[turn] + result.capturedStones.length,
    }));
    setLastMove([r, c]);
    setKoPoint(result.nextKoPoint);
    setConsecutivePasses(0); // Đã đánh quân nên reset chuỗi Pass

    // Đổi lượt
    setTurn(prev => (prev === 'B' ? 'W' : 'B'));
  };

  // NƯỚC PASS (BỎ LƯỢT)
  const handlePass = () => {
    if (gameResult) return;
    if (gameMode === 'ai' && turn === aiColor) return;

    processPass(turn);
  };

  const processPass = (passer) => {
    const nextPassCount = consecutivePasses + 1;
    setConsecutivePasses(nextPassCount);
    setKoPoint(null); // Pass thì xoá ràng buộc Kiếp

    // Lưu lịch sử
    setHistory(prev => [
      ...prev,
      {
        board: board.map(row => [...row]),
        turn,
        captured: { ...captured },
        koPoint,
        lastMove,
        consecutivePasses,
      },
    ]);

    if (nextPassCount >= 2) {
      // 2 bên cùng Pass liên tiếp -> KẾT THÚC VÁN ĐẤU
      const finalResult = calculateFinalScore(board, captured, komi);
      setGameResult({
        ...finalResult,
        reason: 'Hai bên cùng thống nhất Bỏ lượt (Pass). Trận đấu kết thúc!',
      });
      return;
    }

    // Đổi lượt
    setTurn(passer === 'B' ? 'W' : 'B');
  };

  // NÚT ĐẦU HÀNG (RESIGN)
  const handleResign = () => {
    if (gameResult) return;
    const confirmResign = window.confirm(`Bạn có chắc chắn muốn Đầu hàng (${turn === 'B' ? 'Đen' : 'Trắng'}) không?`);
    if (!confirmResign) return;

    const winner = turn === 'B' ? 'Trắng (White)' : 'Đen (Black)';
    setGameResult({
      winner,
      scoreB: captured.B,
      scoreW: captured.W + komi,
      margin: 'Đầu hàng',
      reason: `${turn === 'B' ? 'Quân Đen' : 'Quân Trắng'} đã xin nhận thua (Resign).`,
    });
  };

  // HOÀN TÁC (UNDO)
  const handleUndo = () => {
    if (history.length === 0 || gameResult) return;

    // Trong chế độ AI, cần lùi 2 nước (nước AI và nước Người)
    const stepsToUndo = gameMode === 'ai' && history.length >= 2 ? 2 : 1;
    const targetSnapshot = history[history.length - stepsToUndo];

    setBoard(targetSnapshot.board);
    setTurn(targetSnapshot.turn);
    setCaptured(targetSnapshot.captured);
    setKoPoint(targetSnapshot.koPoint);
    setLastMove(targetSnapshot.lastMove);
    setConsecutivePasses(targetSnapshot.consecutivePasses);
    setHistory(prev => prev.slice(0, prev.length - stepsToUndo));
    setGameResult(null);
  };

  // --- TRÍ TUỆ NHÂN TẠO (GO AI ENGINE) ---
  useEffect(() => {
    if (gameMode !== 'ai' || turn !== aiColor || gameResult) return;

    setIsAiThinking(true);
    const timer = setTimeout(() => {
      runAiMove();
      setIsAiThinking(false);
    }, 450);

    return () => clearTimeout(timer);
  }, [turn, gameMode, aiColor, gameResult]);

  const runAiMove = () => {
    const legalMoves = [];
    const opponent = aiColor === 'B' ? 'W' : 'B';

    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const res = evaluateMove(board, r, c, aiColor, koPoint);
        if (res.valid) {
          // Đánh giá điểm ưu tiên của nước đi
          let score = 0;

          // 1. Ăn được tù binh địch (ưu tiên cực cao)
          score += res.capturedStones.length * 50;

          // 2. Bảo vệ nhóm quân mình đang gặp nguy hiểm (Atari)
          const selfGroup = getGroupAndLiberties(res.newBoard, r, c);
          if (selfGroup.liberties.size >= 3) score += 15;
          else if (selfGroup.liberties.size === 2) score += 5;

          // 3. Khống chế trung tâm và điểm sao (Hoshi)
          const centerDist = Math.abs(r - Math.floor(N / 2)) + Math.abs(c - Math.floor(N / 2));
          score += (N - centerDist) * 2;

          // 4. Tránh biên sát mép (line 1) trừ khi ăn được quân
          if ((r === 0 || r === N - 1 || c === 0 || c === N - 1) && res.capturedStones.length === 0) {
            score -= 10;
          }

          legalMoves.push({ r, c, result: res, score });
        }
      }
    }

    if (legalMoves.length === 0) {
      // Hết nước đi hợp lệ -> AI Pass
      processPass(aiColor);
      return;
    }

    // Sắp xếp các nước đi tốt nhất và chọn ngẫu nhiên top moves để tạo cảm giác tự nhiên
    legalMoves.sort((a, b) => b.score - a.score);
    const topScore = legalMoves[0].score;

    // Nếu thế cờ quá bất lợi hoặc không còn nước gia tăng đất (toàn điểm âm) và đối thủ vừa Pass -> AI Pass
    if (consecutivePasses === 1 && topScore <= 0) {
      processPass(aiColor);
      return;
    }

    const candidateMoves = legalMoves.filter(m => m.score >= topScore - 5);
    const chosen = candidateMoves[Math.floor(Math.random() * candidateMoves.length)];

    applyMove(chosen.r, chosen.c, chosen.result);
  };

  // Kiểm tra điểm sao Hoshi trên bàn cờ
  const isHoshiPoint = (r, c) => {
    return currentConfig.hoshi.some(([hr, hc]) => hr === r && hc === c);
  };

  return (
    <div className={styles.container}>
      {/* HEADER & THANH ĐIỀU HƯỚNG */}
      <div className={styles.topBar}>
        <Link to="/" className={styles.backLink}>
          ← Kỳ Đạo Quán
        </Link>
        <h1 className={styles.gameTitle}>CỜ VÂY (GO / BADUK)</h1>
        <div className={styles.boardSizeSelector}>
          {BOARD_SIZES.map((cfg, idx) => (
            <button
              key={cfg.size}
              className={`${styles.sizeBtn} ${boardSizeIdx === idx ? styles.activeSize : ''}`}
              onClick={() => setBoardSizeIdx(idx)}
            >
              {cfg.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.mainLayout}>
        {/* KHUNG BÀN CỜ VUÔNG VỨC CHÍNH XÁC */}
        <div className={styles.boardSection}>
          <div
            className={styles.boardWrapper}
            style={{
              '--board-size': N,
            }}
          >
            <div className={styles.gridBoard}>
              {board.map((row, r) => (
                <div key={r} className={styles.row}>
                  {row.map((cell, c) => {
                    const isLast = lastMove && lastMove[0] === r && lastMove[1] === c;
                    const isKo = koPoint && koPoint[0] === r && koPoint[1] === c;
                    const isHoshi = isHoshiPoint(r, c);

                    return (
                      <div
                        key={c}
                        className={styles.intersection}
                        onClick={() => handleCellClick(r, c)}
                      >
                        {/* Giao điểm kẻ chữ thập */}
                        <div className={styles.crossLines}>
                          <div className={styles.lineH}></div>
                          <div className={styles.lineV}></div>
                        </div>

                        {/* Điểm sao Hoshi */}
                        {isHoshi && !cell && <div className={styles.hoshiDot}></div>}

                        {/* Điểm cấm Kiếp (Ko) */}
                        {isKo && !cell && <div className={styles.koMarker} title="Cấm ăn lại (Luật Kiếp)">✕</div>}

                        {/* Quân cờ Đen / Trắng */}
                        {cell && (
                          <div
                            className={`${styles.stone} ${cell === 'B' ? styles.blackStone : styles.whiteStone} ${
                              isLast ? styles.lastStone : ''
                            }`}
                          >
                            {isLast && <div className={styles.lastIndicator}></div>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* BẢNG ĐIỀU KHIỂN & TRẠNG THÁI VÁN ĐẤU */}
        <div className={styles.sidePanel}>
          {/* TRẠNG THÁI LƯỢT ĐI */}
          <div className={styles.card}>
            <h2 className={styles.cardHeading}>Trạng Thái Trận Đấu</h2>
            <div className={styles.turnStatus}>
              <div
                className={`${styles.colorBadge} ${
                  turn === 'B' ? styles.badgeBlack : styles.badgeWhite
                }`}
              >
                {turn === 'B' ? 'Quân Đen (Đi trước)' : `Quân Trắng (+${komi} Komi)`}
              </div>
              <p className={styles.turnNotice}>
                {isAiThinking
                  ? 'Máy đang tính toán khí và thế trận...'
                  : turn === aiColor && gameMode === 'ai'
                  ? 'Lượt của Máy (AI)'
                  : 'Đến lượt bạn hạ quân'}
              </p>
            </div>

            {/* THỐNG KÊ TÙ BINH & ĐIỂM KOMI */}
            <div className={styles.capturesTable}>
              <div className={styles.captureItem}>
                <span className={styles.captureDotBlack}>●</span>
                <span className={styles.captureName}>Đen bắt tù binh:</span>
                <strong className={styles.captureCount}>{captured.B} quân</strong>
              </div>
              <div className={styles.captureItem}>
                <span className={styles.captureDotWhite}>○</span>
                <span className={styles.captureName}>Trắng bắt tù binh:</span>
                <strong className={styles.captureCount}>{captured.W} quân</strong>
              </div>
              <div className={styles.komiNotice}>
                Mục đền bù Komi cho Trắng: <strong>+{komi} mục</strong>
              </div>
              {koPoint && (
                <div className={styles.koWarning}>
                  ⚠️ Điểm ({koPoint[0] + 1}, {koPoint[1] + 1}) đang chịu <strong>Luật Kiếp (Ko)</strong>: Cấm ăn lại ngay!
                </div>
              )}
            </div>
          </div>

          {/* CHẾ ĐỘ CHƠI & CÀI ĐẶT */}
          <div className={styles.card}>
            <h3 className={styles.cardSubheading}>Chế Độ Thi Đấu</h3>
            <div className={styles.modeButtonGroup}>
              <button
                className={`${styles.modeBtn} ${gameMode === 'ai' ? styles.activeMode : ''}`}
                onClick={() => {
                  setGameMode('ai');
                  resetGame();
                }}
              >
                🤖 Đấu với Máy (AI)
              </button>
              <button
                className={`${styles.modeBtn} ${gameMode === 'pvp' ? styles.activeMode : ''}`}
                onClick={() => {
                  setGameMode('pvp');
                  resetGame();
                }}
              >
                👥 2 Người chơi
              </button>
            </div>

            {gameMode === 'ai' && (
              <div className={styles.aiSelector}>
                <span>Bạn cầm quân:</span>
                <button
                  className={`${styles.subBtn} ${aiColor === 'W' ? styles.subBtnActive : ''}`}
                  onClick={() => {
                    setAiColor('W');
                    resetGame();
                  }}
                >
                  Đen (Đi trước)
                </button>
                <button
                  className={`${styles.subBtn} ${aiColor === 'B' ? styles.subBtnActive : ''}`}
                  onClick={() => {
                    setAiColor('B');
                    resetGame();
                  }}
                >
                  Trắng (+{komi} Komi)
                </button>
              </div>
            )}
          </div>

          {/* CÁC THAO TÁC TRẬN ĐẤU */}
          <div className={styles.card}>
            <div className={styles.actionButtonGroup}>
              <button
                className={styles.passBtn}
                onClick={handlePass}
                disabled={gameResult || (gameMode === 'ai' && turn === aiColor)}
                title="Bỏ lượt khi không còn nước đi có lợi. Hai bên cùng Pass sẽ kết thúc và đếm điểm!"
              >
                ⏩ Bỏ lượt (Pass) {consecutivePasses === 1 ? '(1/2 bên đã Pass)' : ''}
              </button>
              <button
                className={styles.resignBtn}
                onClick={handleResign}
                disabled={gameResult}
              >
                🏳️ Đầu hàng (Resign)
              </button>
              <button
                className={styles.undoBtn}
                onClick={handleUndo}
                disabled={history.length === 0 || gameResult}
              >
                ↩ Hoàn tác (Undo)
              </button>
              <button className={styles.resetBtn} onClick={() => resetGame()}>
                🔄 Ván mới
              </button>
            </div>
          </div>

          {/* HƯỚNG DẪN LUẬT QUỐC TẾ */}
          <div className={styles.cardRules}>
            <h4>Quy Chuẩn Luật Cờ Vây Quốc Tế:</h4>
            <ul>
              <li><strong>Khí & Bắt quân:</strong> Quân hoặc đám quân hết khí (các giao điểm liền kề) sẽ bị loại khỏi bàn và tính thành tù binh.</li>
              <li><strong>Cấm Tự Sát:</strong> Không được đặt quân vào ô không còn khí, trừ phi nước đi đó ăn được quân đối phương để mở khí.</li>
              <li><strong>Luật Kiếp (Ko):</strong> Cấm ăn lại tức thì 1 quân đối phương nếu nước cờ dẫn đến lặp lại trạng thái bàn cờ trước đó. Phải đánh ở nơi khác (tìm mối kiếp) trước.</li>
              <li><strong>Komi:</strong> Trắng được cộng <strong>{komi} mục</strong> để bù trừ lợi thế đi trước của Đen.</li>
              <li><strong>Kết thúc:</strong> Khi cả 2 bên cùng liên tiếp Pass, hệ thống sẽ tự động tổng kết Đất + Tù binh + Komi để định đoạt người chiến thắng.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* MODAL KẾT THÚC VÀ TÍNH ĐIỂM TỔNG KẾT */}
      {gameResult && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h2 className={styles.modalTitle}>KẾT THÚC TRẬN ĐẤU</h2>
            <div className={styles.winnerAnnounce}>
              Bên Chiến Thắng: <span className={styles.winnerHighlight}>{gameResult.winner}</span>
            </div>
            <p className={styles.resultReason}>{gameResult.reason}</p>

            {gameResult.margin !== 'Đầu hàng' && (
              <div className={styles.scoreBreakdown}>
                <div className={styles.scoreCol}>
                  <h3>Quân Đen</h3>
                  <p>Đất kiểm soát: <strong>{gameResult.blackTerritory} mục</strong></p>
                  <p>Tù binh bắt được: <strong>{captured.B} quân</strong></p>
                  <p className={styles.totalScore}>Tổng: <strong>{gameResult.scoreB} điểm</strong></p>
                </div>
                <div className={styles.scoreCol}>
                  <h3>Quân Trắng</h3>
                  <p>Đất kiểm soát: <strong>{gameResult.whiteTerritory} mục</strong></p>
                  <p>Tù binh bắt được: <strong>{captured.W} quân</strong></p>
                  <p>Mục bù (Komi): <strong>+{gameResult.komi} mục</strong></p>
                  <p className={styles.totalScore}>Tổng: <strong>{gameResult.scoreW} điểm</strong></p>
                </div>
              </div>
            )}

            <div className={styles.finalMargin}>
              {gameResult.margin !== 'Đầu hàng'
                ? `Cách biệt: ${gameResult.margin} mục`
                : 'Thắng do đối phương đầu hàng'}
            </div>

            <div className={styles.modalActions}>
              <button className={styles.primaryBtn} onClick={() => resetGame()}>
                Chơi Ván Mới
              </button>
              <button className={styles.secondaryBtn} onClick={() => setGameResult(null)}>
                Xem Lại Bàn Cờ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

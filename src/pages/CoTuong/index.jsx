import { useState, useCallback, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import styles from './CoTuong.module.css'

// Ký hiệu chữ Hán: Đỏ (Chữ hoa) / Đen (Chữ thường)
const PIECE_LABELS = {
  K: '帥', A: '仕', E: '相', R: '俥', C: '炮', H: '傌', P: '兵',
  k: '將', a: '士', e: '象', r: '車', c: '砲', h: '馬', p: '卒',
}

const PIECE_VALUES = {
  k: 10000, r: 900, c: 450, h: 400, e: 200, a: 200, p: 100,
  K: 10000, R: 900, C: 450, H: 400, E: 200, A: 200, P: 100,
}

const INITIAL_BOARD = [
  ['r', 'h', 'e', 'a', 'k', 'a', 'e', 'h', 'r'],
  ['', '', '', '', '', '', '', '', ''],
  ['', 'c', '', '', '', '', '', 'c', ''],
  ['p', '', 'p', '', 'p', '', 'p', '', 'p'],
  ['', '', '', '', '', '', '', '', ''],
  ['', '', '', '', '', '', '', '', ''],
  ['P', '', 'P', '', 'P', '', 'P', '', 'P'],
  ['', 'C', '', '', '', '', '', 'C', ''],
  ['', '', '', '', '', '', '', '', ''],
  ['R', 'H', 'E', 'A', 'K', 'A', 'E', 'H', 'R'],
]

export default function CoTuong() {
  const [board, setBoard] = useState(INITIAL_BOARD)
  const [turn, setTurn] = useState('red') // 'red' | 'black'
  const [selected, setSelected] = useState(null)
  const [validMoves, setValidMoves] = useState([])
  const [gameMode, setGameMode] = useState('ai') // 'ai' | 'pvp'
  const [isThinking, setIsThinking] = useState(false)
  const [gameStatus, setGameStatus] = useState({ type: 'normal', msg: '' }) // 'check', 'checkmate', 'stalemate'

  const isRed = (p) => p >= 'A' && p <= 'Z'
  const isBlack = (p) => p >= 'a' && p <= 'z'

  // Tìm vị trí Tướng/Soái
  const findGeneral = (color, b) => {
    const target = color === 'red' ? 'K' : 'k'
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 9; c++) {
        if (b[r][c] === target) return [r, c]
      }
    }
    return null
  }

  // 1. Luật Lộ Diện Tướng: Hai Tướng không được đối mặt trực tiếp trên cùng một cột mà không có quân cản
  const areGeneralsFacing = (b) => {
    const redK = findGeneral('red', b)
    const blackK = findGeneral('black', b)
    if (!redK || !blackK) return false
    if (redK[1] !== blackK[1]) return false // Khác cột thì không đối mặt

    const col = redK[1]
    const minR = Math.min(redK[0], blackK[0])
    const maxR = Math.max(redK[0], blackK[0])

    for (let r = minR + 1; r < maxR; r++) {
      if (b[r][col] !== '') return false // Có quân cản ở giữa
    }
    return true // Hai tướng nhìn thẳng mặt nhau -> Phạm luật
  }

  // 2. Nước đi giả định của một quân (Pseudo-legal moves)
  const getPseudoMoves = useCallback((r, c, b = board) => {
    const piece = b[r][c]
    if (!piece) return []
    const moves = []
    const red = isRed(piece)
    const type = piece.toUpperCase()

    const add = (nr, nc) => {
      if (nr < 0 || nr > 9 || nc < 0 || nc > 8) return false
      const target = b[nr][nc]
      if (!target) {
        moves.push([nr, nc])
        return true
      }
      if (red ? isBlack(target) : isRed(target)) {
        moves.push([nr, nc])
      }
      return false
    }

    // 1. Xe (Chariot): Đi ngang dọc tự do
    if (type === 'R') {
      [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dr, dc]) => {
        let step = 1
        while (add(r + dr * step, c + dc * step)) step++
      })
    }
    // 2. Mã (Horse): Đi chữ nhật, có cản chân mã
    else if (type === 'H') {
      const horseSteps = [
        [-2, -1, -1, 0], [-2, 1, -1, 0],
        [2, -1, 1, 0],   [2, 1, 1, 0],
        [-1, -2, 0, -1], [1, -2, 0, -1],
        [-1, 2, 0, 1],   [1, 2, 0, 1],
      ]
      horseSteps.forEach(([dr, dc, br, bc]) => {
        if (!b[r + br]?.[c + bc]) add(r + dr, c + dc)
      })
    }
    // 3. Pháo (Cannon): Nhảy qua đúng 1 quân để ăn
    else if (type === 'C') {
      [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dr, dc]) => {
        let step = 1
        let jumped = false
        while (true) {
          const nr = r + dr * step, nc = c + dc * step
          if (nr < 0 || nr > 9 || nc < 0 || nc > 8) break
          const target = b[nr][nc]
          if (!jumped) {
            if (!target) moves.push([nr, nc])
            else jumped = true
          } else {
            if (target) {
              if (red ? isBlack(target) : isRed(target)) moves.push([nr, nc])
              break
            }
          }
          step++
        }
      })
    }
    // 4. Tượng (Elephant): Đi chéo 2 ô, không qua sông, có cản mắt tượng
    else if (type === 'E') {
      const elephantSteps = [
        [-2, -2, -1, -1], [-2, 2, -1, 1],
        [2, -2, 1, -1],   [2, 2, 1, 1],
      ]
      elephantSteps.forEach(([dr, dc, eyeR, eyeC]) => {
        const nr = r + dr, nc = c + dc
        const stayHome = red ? nr >= 5 : nr <= 4
        if (stayHome && !b[r + eyeR]?.[c + eyeC]) {
          add(nr, nc)
        }
      })
    }
    // 5. Sĩ (Advisor): Đi chéo 1 ô trong Cửu Cung
    else if (type === 'A') {
      [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([dr, dc]) => {
        const nr = r + dr, nc = c + dc
        const palaceRow = red ? nr >= 7 && nr <= 9 : nr >= 0 && nr <= 2
        if (palaceRow && nc >= 3 && nc <= 5) add(nr, nc)
      })
    }
    // 6. Tướng (General): Đi ngang dọc 1 ô trong Cửu Cung
    else if (type === 'K') {
      [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dr, dc]) => {
        const nr = r + dr, nc = c + dc
        const palaceRow = red ? nr >= 7 && nr <= 9 : nr >= 0 && nr <= 2
        if (palaceRow && nc >= 3 && nc <= 5) add(nr, nc)
      })
    }
    // 7. Tốt/Binh (Pawn): Chưa qua sông đi tiến; qua sông đi tiến hoặc ngang
    else if (type === 'P') {
      const dir = red ? -1 : 1
      add(r + dir, c)
      const crossedRiver = red ? r <= 4 : r >= 5
      if (crossedRiver) {
        add(r, c - 1)
        add(r, c + 1)
      }
    }

    return moves
  }, [board])

  // 3. Kiểm tra Tướng có đang bị Chiếu (Check)
  const isGeneralInCheck = useCallback((color, b) => {
    // 3.1 Hai Tướng nhìn nhau
    if (areGeneralsFacing(b)) return true

    const genPos = findGeneral(color, b)
    if (!genPos) return true // Mất tướng coi như bị chiếu bí

    const [gr, gc] = genPos
    const isEnemy = color === 'red' ? isBlack : isRed

    // Kiểm tra tất cả quân địch có thể ăn tới vị trí Tướng hay không
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 9; c++) {
        const piece = b[r][c]
        if (piece && isEnemy(piece)) {
          const pseudoMoves = getPseudoMoves(r, c, b)
          if (pseudoMoves.some(([mr, mc]) => mr === gr && mc === gc)) {
            return true
          }
        }
      }
    }
    return false
  }, [getPseudoMoves])

  // 4. Lọc NƯỚC ĐI HỢP LỆ THEO LUẬT CỜ TƯỚNG VIỆT NAM & WXF:
  // Nước đi không được để Tướng mình bị chiếu và không làm 2 Tướng đối mặt
  const getLegalMoves = useCallback((r, c, b = board) => {
    const piece = b[r][c]
    if (!piece) return []
    const color = isRed(piece) ? 'red' : 'black'
    const pseudoMoves = getPseudoMoves(r, c, b)

    return pseudoMoves.filter(([toR, toC]) => {
      // Mô phỏng nước đi
      const simulated = b.map(row => [...row])
      simulated[toR][toC] = simulated[r][c]
      simulated[r][c] = ''

      // Kiểm tra Tướng mình có an toàn không
      return !isGeneralInCheck(color, simulated)
    })
  }, [getPseudoMoves, isGeneralInCheck])

  // 5. Đánh giá trạng thái Chiếu / Chiếu Bí / Khốn Tướng (Hết nước đi)
  const evaluateGameState = useCallback((currentTurn, b) => {
    const inCheck = isGeneralInCheck(currentTurn, b)

    // Đếm tổng số nước đi hợp lệ của bên hiện tại
    let totalLegalMoves = 0
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 9; c++) {
        const piece = b[r][c]
        if (piece && (currentTurn === 'red' ? isRed(piece) : isBlack(piece))) {
          const moves = getLegalMoves(r, c, b)
          totalLegalMoves += moves.length
          if (totalLegalMoves > 0) break
        }
      }
      if (totalLegalMoves > 0) break
    }

    if (totalLegalMoves === 0) {
      if (inCheck) {
        return {
          type: 'checkmate',
          msg: `🏆 CHIẾU BÍ! ${currentTurn === 'red' ? 'BÊN ĐEN THẮNG' : 'BÊN ĐỎ THẮNG'}!`,
        }
      } else {
        // Theo Luật Cờ Tướng Việt Nam & WXF: Khốn Tướng (hết nước đi hợp lệ) bị xử THUA
        return {
          type: 'stalemate',
          msg: `🏆 KHỐN TƯỚNG! ${currentTurn === 'red' ? 'Bên Đỏ hết nước đi (Đen Thắng)' : 'Bên Đen hết nước đi (Đỏ Thắng)'}!`,
        }
      }
    }

    if (inCheck) {
      return {
        type: 'check',
        msg: `⚠️ ${currentTurn === 'red' ? 'Tướng Đỏ' : 'Tướng Đen'} ĐANG BỊ CHIẾU TƯỚNG!`,
      }
    }

    return { type: 'normal', msg: '' }
  }, [isGeneralInCheck, getLegalMoves])

  const executeMove = useCallback((fromR, fromC, toR, toC) => {
    const nextBoard = board.map(row => [...row])
    nextBoard[toR][toC] = nextBoard[fromR][fromC]
    nextBoard[fromR][fromC] = ''

    setBoard(nextBoard)
    setSelected(null)
    setValidMoves([])

    const nextTurn = turn === 'red' ? 'black' : 'red'
    setTurn(nextTurn)

    const status = evaluateGameState(nextTurn, nextBoard)
    setGameStatus(status)
  }, [board, turn, evaluateGameState])

  // ── AI Engine Xiangqi (Black) ────────────────────────────────────────────
  useEffect(() => {
    if (gameMode !== 'ai' || turn !== 'black' || gameStatus.type === 'checkmate' || gameStatus.type === 'stalemate') {
      return
    }

    setIsThinking(true)
    const timer = setTimeout(() => {
      const allMoves = []
      for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 9; c++) {
          const piece = board[r][c]
          if (piece && isBlack(piece)) {
            const moves = getLegalMoves(r, c, board)
            moves.forEach(([tr, tc]) => {
              allMoves.push({ fromR: r, fromC: c, toR: tr, toC: tc, piece })
            })
          }
        }
      }

      if (allMoves.length === 0) {
        setIsThinking(false)
        return
      }

      const scoredMoves = allMoves.map(m => {
        let score = 0
        const targetPiece = board[m.toR][m.toC]
        if (targetPiece) {
          score += (PIECE_VALUES[targetPiece] || 100) * 10
        }

        if (m.piece === 'r') score += 25
        if (m.piece === 'c') score += 20
        if (m.piece === 'h') score += 15

        // Tốt qua sông áp sát Cửu Cung Đỏ
        if (m.piece === 'p') {
          if (m.toR >= 5) score += 45
          score += m.toR * 8
        }

        // Tấn công vào Cửu Cung Đỏ
        if (m.toR >= 7 && m.toC >= 3 && m.toC <= 5) {
          score += 65
        }

        score += Math.random() * 8
        return { ...m, score }
      })

      scoredMoves.sort((a, b) => b.score - a.score)
      const best = scoredMoves[0]

      executeMove(best.fromR, best.fromC, best.toR, best.toC)
      setIsThinking(false)
    }, 450)

    return () => clearTimeout(timer)
  }, [turn, gameMode, board, gameStatus, getLegalMoves, executeMove])

  const handleClick = (r, c) => {
    if (isThinking && gameMode === 'ai' && turn === 'black') return
    if (gameStatus.type === 'checkmate' || gameStatus.type === 'stalemate') return

    const piece = board[r][c]
    const isCurrentPlayer = piece && (turn === 'red' ? isRed(piece) : isBlack(piece))

    if (selected) {
      const [sr, sc] = selected
      if (validMoves.some(([vr, vc]) => vr === r && vc === c)) {
        executeMove(sr, sc, r, c)
        return
      }
    }

    if (isCurrentPlayer) {
      setSelected([r, c])
      setValidMoves(getLegalMoves(r, c, board))
    } else {
      setSelected(null)
      setValidMoves([])
    }
  }

  const resetGame = () => {
    setBoard(INITIAL_BOARD)
    setTurn('red')
    setSelected(null)
    setValidMoves([])
    setGameStatus({ type: 'normal', msg: '' })
    setIsThinking(false)
  }

  const redGenPos = useMemo(() => findGeneral('red', board), [board])
  const blackGenPos = useMemo(() => findGeneral('black', board), [board])
  const isRedInCheck = gameStatus.type === 'check' && turn === 'red'
  const isBlackInCheck = gameStatus.type === 'check' && turn === 'black'

  return (
    <div className={styles.container}>
      {/* Top Bar */}
      <div className={styles.topNav}>
        <Link to="/" className={styles.backBtn}>← Quay Lại</Link>

        <div className={styles.hud}>
          <button
            className={`${styles.modeToggle} ${gameMode === 'ai' ? styles.modeActive : ''}`}
            onClick={() => { setGameMode('ai'); resetGame() }}
          >
            🤖 Đấu với Máy
          </button>
          <button
            className={`${styles.modeToggle} ${gameMode === 'pvp' ? styles.modeActive : ''}`}
            onClick={() => { setGameMode('pvp'); resetGame() }}
          >
            👥 2 Người
          </button>

          <div className={styles.turnIndicator}>
            {isThinking ? (
              <>
                <span className={styles.thinkingDot} />
                <span>Máy đang tính...</span>
              </>
            ) : (
              <>
                <span
                  className={`${styles.turnDot} ${
                    turn === 'red' ? styles.dotRed : styles.dotBlack
                  }`}
                />
                <span>{turn === 'red' ? 'Đỏ đi' : 'Đen đi'}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Official Status Alert Banner */}
      {gameStatus.msg && (
        <div
          className={`${styles.statusBanner} ${
            gameStatus.type === 'checkmate' || gameStatus.type === 'stalemate'
              ? styles.gameEndAlert
              : styles.checkAlert
          }`}
        >
          {gameStatus.msg}
        </div>
      )}

      {/* Board Frame */}
      <div className={styles.boardWrapper}>
        <div className={styles.board}>
          {/* Subtle River Label Overlay */}
          <div className={styles.riverOverlay}>
            <span className={styles.riverText}>楚 河 (SỞ HÀ)</span>
            <span className={styles.riverText}>漢 界 (HÁN GIỚI)</span>
          </div>

          {/* 90 Strict Square Cells */}
          {board.map((row, r) =>
            row.map((piece, c) => {
              const isSel = selected && selected[0] === r && selected[1] === c
              const isValid = validMoves.some(([vr, vc]) => vr === r && vc === c)
              const isCheckingKing =
                (isRedInCheck && redGenPos && redGenPos[0] === r && redGenPos[1] === c) ||
                (isBlackInCheck && blackGenPos && blackGenPos[0] === r && blackGenPos[1] === c)

              return (
                <div
                  key={`${r}-${c}`}
                  className={`${styles.cell} ${isValid ? styles.validPoint : ''}`}
                  onClick={() => handleClick(r, c)}
                >
                  {piece && (
                    <div
                      className={[
                        styles.piece,
                        isRed(piece) ? styles.redPiece : styles.blackPiece,
                        isSel ? styles.selected : '',
                        isCheckingKing ? styles.inCheckKing : '',
                      ].join(' ')}
                    >
                      {PIECE_LABELS[piece]}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Bottom Controls */}
      <div className={styles.bottomBar}>
        <button className={styles.btn} onClick={resetGame}>
          Ván Mới
        </button>
      </div>
    </div>
  )
}

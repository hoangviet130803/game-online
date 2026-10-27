import { useState, useCallback, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import styles from './CoVua.module.css'

const PIECES = {
  r: '♜', n: '♞', b: '♝', q: '♛', k: '♚', p: '♟',
  R: '♖', N: '♘', B: '♗', Q: '♕', K: '♔', P: '♙',
}

const PIECE_VALUES = {
  p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000,
  P: 100, N: 320, B: 330, R: 500, Q: 900, K: 20000,
}

const INITIAL_BOARD = [
  ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
  ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
  ['', '', '', '', '', '', '', ''],
  ['', '', '', '', '', '', '', ''],
  ['', '', '', '', '', '', '', ''],
  ['', '', '', '', '', '', '', ''],
  ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
  ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'],
]

const INITIAL_CASTLING = {
  K: true, // White King hasn't moved
  R_kingside: true, // White Kingside Rook h1 hasn't moved
  R_queenside: true, // White Queenside Rook a1 hasn't moved
  k: true, // Black King hasn't moved
  r_kingside: true, // Black Kingside Rook h8 hasn't moved
  r_queenside: true, // Black Queenside Rook a8 hasn't moved
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1']

export default function CoVua() {
  const [board, setBoard] = useState(INITIAL_BOARD)
  const [turn, setTurn] = useState('white') // 'white' | 'black'
  const [selected, setSelected] = useState(null)
  const [validMoves, setValidMoves] = useState([])
  const [captured, setCaptured] = useState({ white: [], black: [] })
  const [gameMode, setGameMode] = useState('ai') // 'ai' | 'pvp'
  const [isThinking, setIsThinking] = useState(false)
  const [castlingRights, setCastlingRights] = useState(INITIAL_CASTLING)
  const [enPassantTarget, setEnPassantTarget] = useState(null) // [r, c] square behind pawn that moved 2 squares
  const [pendingPromotion, setPendingPromotion] = useState(null) // { fromR, fromC, toR, toC, isCapture }
  const [gameStatus, setGameStatus] = useState({ type: 'normal', msg: '' }) // 'check', 'checkmate', 'stalemate'

  const isWhite = (char) => char >= 'A' && char <= 'Z'
  const isBlack = (char) => char >= 'a' && char <= 'z'

  // Tìm vị trí Vua
  const findKing = (color, b) => {
    const kingChar = color === 'white' ? 'K' : 'k'
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (b[r][c] === kingChar) return [r, c]
      }
    }
    return null
  }

  // 1. Kiểm tra xem ô (r, c) có đang bị quân địch tấn công hay không (Square under attack)
  const isSquareAttacked = useCallback((r, c, byColor, b) => {
    const isEnemy = byColor === 'white' ? isWhite : isBlack

    // 1.1 Tốt địch tấn công
    const pawnDir = byColor === 'white' ? 1 : -1
    for (const dc of [-1, 1]) {
      const pr = r + pawnDir, pc = c + dc
      if (pr >= 0 && pr < 8 && pc >= 0 && pc < 8) {
        const p = b[pr][pc]
        if (p && isEnemy(p) && p.toLowerCase() === 'p') return true
      }
    }

    // 1.2 Mã địch tấn công
    const knightOffsets = [
      [-2, -1], [-2, 1], [-1, -2], [-1, 2],
      [1, -2], [1, 2], [2, -1], [2, 1],
    ]
    for (const [dr, dc] of knightOffsets) {
      const nr = r + dr, nc = c + dc
      if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
        const p = b[nr][nc]
        if (p && isEnemy(p) && p.toLowerCase() === 'n') return true
      }
    }

    // 1.3 Xe / Hậu địch tấn công (đường thẳng)
    const straightDirs = [[-1, 0], [1, 0], [0, -1], [0, 1]]
    for (const [dr, dc] of straightDirs) {
      let step = 1
      while (true) {
        const nr = r + dr * step, nc = c + dc * step
        if (nr < 0 || nr > 7 || nc < 0 || nc > 7) break
        const p = b[nr][nc]
        if (p) {
          if (isEnemy(p) && (p.toLowerCase() === 'r' || p.toLowerCase() === 'q')) return true
          break
        }
        step++
      }
    }

    // 1.4 Tượng / Hậu địch tấn công (đường chéo)
    const diagDirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]]
    for (const [dr, dc] of diagDirs) {
      let step = 1
      while (true) {
        const nr = r + dr * step, nc = c + dc * step
        if (nr < 0 || nr > 7 || nc < 0 || nc > 7) break
        const p = b[nr][nc]
        if (p) {
          if (isEnemy(p) && (p.toLowerCase() === 'b' || p.toLowerCase() === 'q')) return true
          break
        }
        step++
      }
    }

    // 1.5 Vua địch ở gần (1 ô)
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue
        const nr = r + dr, nc = c + dc
        if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
          const p = b[nr][nc]
          if (p && isEnemy(p) && p.toLowerCase() === 'k') return true
        }
      }
    }

    return false
  }, [])

  // 2. Kiểm tra Vua có đang bị Chiếu (In Check)
  const isKingInCheck = useCallback((color, b) => {
    const kingPos = findKing(color, b)
    if (!kingPos) return false
    const enemyColor = color === 'white' ? 'black' : 'white'
    return isSquareAttacked(kingPos[0], kingPos[1], enemyColor, b)
  }, [isSquareAttacked])

  // 3. Tạo các nước đi giả định (Pseudo-legal moves) bao gồm Nhập thành và Bắt tốt qua đường
  const getPseudoMoves = useCallback((r, c, b = board, rights = castlingRights, epTarget = enPassantTarget) => {
    const piece = b[r][c]
    if (!piece) return []
    const moves = []
    const white = isWhite(piece)
    const type = piece.toLowerCase()

    const add = (nr, nc) => {
      if (nr < 0 || nr > 7 || nc < 0 || nc > 7) return false
      const target = b[nr][nc]
      if (!target) {
        moves.push([nr, nc])
        return true
      }
      if (white ? isBlack(target) : isWhite(target)) {
        moves.push([nr, nc])
      }
      return false
    }

    if (type === 'p') {
      const dir = white ? -1 : 1
      const startRow = white ? 6 : 1

      // Đi thẳng 1 ô
      if (!b[r + dir]?.[c]) {
        moves.push([r + dir, c])
        // Đi thẳng 2 ô từ vị trí xuất phát
        if (r === startRow && !b[r + 2 * dir]?.[c]) {
          moves.push([r + 2 * dir, c])
        }
      }

      // Ăn chéo thông thường
      for (const dc of [-1, 1]) {
        const nr = r + dir, nc = c + dc
        if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
          const target = b[nr][nc]
          if (target && (white ? isBlack(target) : isWhite(target))) {
            moves.push([nr, nc])
          }
          // Bắt tốt qua đường (En Passant)
          if (epTarget && epTarget[0] === nr && epTarget[1] === nc) {
            moves.push([nr, nc])
          }
        }
      }
    } else if (type === 'n') {
      const knightOffsets = [
        [-2, -1], [-2, 1], [-1, -2], [-1, 2],
        [1, -2], [1, 2], [2, -1], [2, 1],
      ]
      knightOffsets.forEach(([dr, dc]) => add(r + dr, c + dc))
    } else if (type === 'b' || type === 'r' || type === 'q') {
      const dirs = []
      if (type !== 'r') dirs.push([-1, -1], [-1, 1], [1, -1], [1, 1])
      if (type !== 'b') dirs.push([-1, 0], [1, 0], [0, -1], [0, 1])
      dirs.forEach(([dr, dc]) => {
        let step = 1
        while (add(r + dr * step, c + dc * step)) step++
      })
    } else if (type === 'k') {
      // 8 hướng đi thông thường
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr || dc) add(r + dr, c + dc)
        }
      }

      // Luật Nhập thành (Castling FIDE)
      const enemyColor = white ? 'black' : 'white'
      const inCheck = isSquareAttacked(r, c, enemyColor, b)

      if (!inCheck) {
        if (white && r === 7 && c === 4) {
          // Nhập thành gần (Kingside O-O: Trắng)
          if (rights.K && rights.R_kingside && !b[7][5] && !b[7][6] && b[7][7] === 'R') {
            if (!isSquareAttacked(7, 5, enemyColor, b) && !isSquareAttacked(7, 6, enemyColor, b)) {
              moves.push([7, 6])
            }
          }
          // Nhập thành xa (Queenside O-O-O: Trắng)
          if (rights.K && rights.R_queenside && !b[7][3] && !b[7][2] && !b[7][1] && b[7][0] === 'R') {
            if (!isSquareAttacked(7, 3, enemyColor, b) && !isSquareAttacked(7, 2, enemyColor, b)) {
              moves.push([7, 2])
            }
          }
        } else if (!white && r === 0 && c === 4) {
          // Nhập thành gần (Kingside O-O: Đen)
          if (rights.k && rights.r_kingside && !b[0][5] && !b[0][6] && b[0][7] === 'r') {
            if (!isSquareAttacked(0, 5, enemyColor, b) && !isSquareAttacked(0, 6, enemyColor, b)) {
              moves.push([0, 6])
            }
          }
          // Nhập thành xa (Queenside O-O-O: Đen)
          if (rights.k && rights.r_queenside && !b[0][3] && !b[0][2] && !b[0][1] && b[0][0] === 'r') {
            if (!isSquareAttacked(0, 3, enemyColor, b) && !isSquareAttacked(0, 2, enemyColor, b)) {
              moves.push([0, 2])
            }
          }
        }
      }
    }
    return moves
  }, [board, castlingRights, enPassantTarget, isSquareAttacked])

  // 4. Lọc các nước đi HỢP LỆ THEO LUẬT (Legal Moves: Không để Vua mình bị chiếu)
  const getLegalMoves = useCallback((r, c, b = board, rights = castlingRights, epTarget = enPassantTarget) => {
    const piece = b[r][c]
    if (!piece) return []
    const color = isWhite(piece) ? 'white' : 'black'
    const pseudoMoves = getPseudoMoves(r, c, b, rights, epTarget)

    return pseudoMoves.filter(([toR, toC]) => {
      // Mô phỏng nước đi
      const simulated = b.map(row => [...row])
      const moving = simulated[r][c]

      // Xử lý ăn tốt qua đường trên bàn cờ mô phỏng
      if (moving.toLowerCase() === 'p' && epTarget && toR === epTarget[0] && toC === epTarget[1]) {
        const epPawnRow = color === 'white' ? toR + 1 : toR - 1
        simulated[epPawnRow][toC] = ''
      }

      // Xử lý nhập thành trên bàn cờ mô phỏng
      if (moving.toLowerCase() === 'k' && Math.abs(toC - c) === 2) {
        if (toC === 6) {
          simulated[r][5] = simulated[r][7]
          simulated[r][7] = ''
        } else if (toC === 2) {
          simulated[r][3] = simulated[r][0]
          simulated[r][0] = ''
        }
      }

      simulated[toR][toC] = moving
      simulated[r][c] = ''

      // Nước đi chỉ hợp lệ nếu Vua mình không bị chiếu sau khi đi
      return !isKingInCheck(color, simulated)
    })
  }, [getPseudoMoves, isKingInCheck])

  // 5. Kiểm tra Chiếu / Chiếu Bí (Checkmate) / Hòa cờ Bế tắc (Stalemate)
  const evaluateGameState = useCallback((currentTurn, b, rights, ep) => {
    const inCheck = isKingInCheck(currentTurn, b)

    // Đếm tổng số nước đi hợp lệ của bên hiện tại
    let totalLegalMoves = 0
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = b[r][c]
        if (piece && (currentTurn === 'white' ? isWhite(piece) : isBlack(piece))) {
          const moves = getLegalMoves(r, c, b, rights, ep)
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
          msg: `🏆 CHIẾU BÍ! ${currentTurn === 'white' ? 'ĐEN THẮNG' : 'TRẮNG THẮNG'}!`,
        }
      } else {
        return {
          type: 'stalemate',
          msg: '🤝 HÒA CỜ! Bên đi không còn nước hợp lệ (Bế Tắc / Stalemate)!',
        }
      }
    }

    if (inCheck) {
      return {
        type: 'check',
        msg: `⚠️ ${currentTurn === 'white' ? 'Vua Trắng' : 'Vua Đen'} ĐANG BỊ CHIẾU!`,
      }
    }

    return { type: 'normal', msg: '' }
  }, [isKingInCheck, getLegalMoves])

  // Thực thi nước đi chính thức
  const executeMove = useCallback((fromR, fromC, toR, toC, promotionChoice = null) => {
    const piece = board[fromR][fromC]
    const color = isWhite(piece) ? 'white' : 'black'
    const nextBoard = board.map(row => [...row])
    let capturedPiece = nextBoard[toR][toC]

    // 1. Kiểm tra Bắt tốt qua đường (En Passant)
    let isEnPassant = false
    if (
      piece.toLowerCase() === 'p' &&
      enPassantTarget &&
      toR === enPassantTarget[0] &&
      toC === enPassantTarget[1]
    ) {
      isEnPassant = true
      const epPawnRow = color === 'white' ? toR + 1 : toR - 1
      capturedPiece = nextBoard[epPawnRow][toC]
      nextBoard[epPawnRow][toC] = ''
    }

    // 2. Kiểm tra Nhập thành (Castling)
    if (piece.toLowerCase() === 'k' && Math.abs(toC - fromC) === 2) {
      if (toC === 6) {
        // Nhập thành gần
        nextBoard[fromR][5] = nextBoard[fromR][7]
        nextBoard[fromR][7] = ''
      } else if (toC === 2) {
        // Nhập thành xa
        nextBoard[fromR][3] = nextBoard[fromR][0]
        nextBoard[fromR][0] = ''
      }
    }

    // 3. Phong cấp Tốt (Pawn Promotion)
    let finalPiece = piece
    const isPromotion =
      piece.toLowerCase() === 'p' && ((color === 'white' && toR === 0) || (color === 'black' && toR === 7))
    if (isPromotion) {
      const choice = promotionChoice || (color === 'white' ? 'Q' : 'q')
      finalPiece = color === 'white' ? choice.toUpperCase() : choice.toLowerCase()
    }

    nextBoard[toR][toC] = finalPiece
    nextBoard[fromR][fromC] = ''

    // Cập nhật quân bị ăn
    if (capturedPiece) {
      setCaptured(c => ({
        ...c,
        [color]: [...c[color], capturedPiece],
      }))
    }

    // Cập nhật quyền Nhập thành (Castling rights)
    const nextRights = { ...castlingRights }
    if (piece === 'K') nextRights.K = false
    if (piece === 'k') nextRights.k = false
    if (fromR === 7 && fromC === 0) nextRights.R_queenside = false
    if (fromR === 7 && fromC === 7) nextRights.R_kingside = false
    if (fromR === 0 && fromC === 0) nextRights.r_queenside = false
    if (fromR === 0 && fromC === 7) nextRights.r_kingside = false

    // Cập nhật ô Bắt tốt qua đường mới (En Passant target)
    let nextEp = null
    if (piece.toLowerCase() === 'p' && Math.abs(toR - fromR) === 2) {
      nextEp = [(fromR + toR) / 2, fromC]
    }

    setBoard(nextBoard)
    setCastlingRights(nextRights)
    setEnPassantTarget(nextEp)
    setSelected(null)
    setValidMoves([])

    const nextTurn = color === 'white' ? 'black' : 'white'
    setTurn(nextTurn)

    // Đánh giá tình trạng Chiếu / Chiếu Bí cho đối thủ
    const status = evaluateGameState(nextTurn, nextBoard, nextRights, nextEp)
    setGameStatus(status)
  }, [board, enPassantTarget, castlingRights, evaluateGameState])

  // ── AI Engine FIDE for Chess (Black) ──────────────────────────────────────
  useEffect(() => {
    if (gameMode !== 'ai' || turn !== 'black' || gameStatus.type === 'checkmate' || gameStatus.type === 'stalemate') {
      return
    }

    setIsThinking(true)
    const timer = setTimeout(() => {
      const allMoves = []
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const piece = board[r][c]
          if (piece && isBlack(piece)) {
            const moves = getLegalMoves(r, c, board, castlingRights, enPassantTarget)
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

      // Đánh giá điểm theo luật FIDE & thế trận
      const scoredMoves = allMoves.map(m => {
        let score = 0
        const targetPiece = board[m.toR][m.toC]
        if (targetPiece) {
          score += (PIECE_VALUES[targetPiece] || 100) * 10
        }

        // Ưu tiên phong Hậu
        if (m.piece === 'p' && m.toR === 7) score += 900

        // Nhập thành an toàn Vua
        if (m.piece === 'k' && Math.abs(m.toC - m.fromC) === 2) {
          score += 60
        }

        // Kiểm soát trung tâm
        if ((m.toR === 3 || m.toR === 4) && (m.toC === 3 || m.toC === 4)) {
          score += 25
        }

        // Phát triển quân nhẹ
        if (m.piece === 'n' || m.piece === 'b') score += 18

        score += Math.random() * 8
        return { ...m, score }
      })

      scoredMoves.sort((a, b) => b.score - a.score)
      const best = scoredMoves[0]

      executeMove(best.fromR, best.fromC, best.toR, best.toC, 'q')
      setIsThinking(false)
    }, 450)

    return () => clearTimeout(timer)
  }, [turn, gameMode, board, castlingRights, enPassantTarget, gameStatus, getLegalMoves, executeMove])

  // Xử lý Click trên bàn cờ
  const handleClick = (r, c) => {
    if (isThinking && gameMode === 'ai' && turn === 'black') return
    if (gameStatus.type === 'checkmate' || gameStatus.type === 'stalemate') return
    if (pendingPromotion) return

    const piece = board[r][c]
    const isCurrentPlayer = piece && (turn === 'white' ? isWhite(piece) : isBlack(piece))

    if (selected) {
      const [sr, sc] = selected
      const isMoveValid = validMoves.some(([vr, vc]) => vr === r && vc === c)

      if (isMoveValid) {
        const moving = board[sr][sc]
        // Kiểm tra phong cấp người chơi
        if (
          moving.toLowerCase() === 'p' &&
          ((turn === 'white' && r === 0) || (turn === 'black' && r === 7))
        ) {
          setPendingPromotion({ fromR: sr, fromC: sc, toR: r, toC: c })
          return
        }

        executeMove(sr, sc, r, c)
        return
      }
    }

    if (isCurrentPlayer) {
      setSelected([r, c])
      setValidMoves(getLegalMoves(r, c, board, castlingRights, enPassantTarget))
    } else {
      setSelected(null)
      setValidMoves([])
    }
  }

  const handlePromotionSelect = (pieceType) => {
    if (!pendingPromotion) return
    executeMove(
      pendingPromotion.fromR,
      pendingPromotion.fromC,
      pendingPromotion.toR,
      pendingPromotion.toC,
      pieceType
    )
    setPendingPromotion(null)
  }

  const resetGame = () => {
    setBoard(INITIAL_BOARD)
    setTurn('white')
    setSelected(null)
    setValidMoves([])
    setCaptured({ white: [], black: [] })
    setCastlingRights(INITIAL_CASTLING)
    setEnPassantTarget(null)
    setPendingPromotion(null)
    setGameStatus({ type: 'normal', msg: '' })
    setIsThinking(false)
  }

  const whiteKingPos = useMemo(() => findKing('white', board), [board])
  const blackKingPos = useMemo(() => findKing('black', board), [board])
  const isWhiteKingInCheck = gameStatus.type === 'check' && turn === 'white'
  const isBlackKingInCheck = gameStatus.type === 'check' && turn === 'black'

  return (
    <div className={styles.container}>
      {/* Top Nav */}
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
                    turn === 'white' ? styles.dotWhite : styles.dotBlack
                  }`}
                />
                <span>{turn === 'white' ? 'Trắng đi' : 'Đen đi'}</span>
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

      {/* Board Frame with Strict Square Aspect Ratio */}
      <div className={styles.boardWrapper}>
        <div className={styles.board}>
          {board.map((row, r) =>
            row.map((piece, c) => {
              const isLight = (r + c) % 2 === 0
              const isSel = selected && selected[0] === r && selected[1] === c
              const isValid = validMoves.some(([vr, vc]) => vr === r && vc === c)
              const isCapture = isValid && (piece !== '' || (enPassantTarget && r === enPassantTarget[0] && c === enPassantTarget[1]))
              const isCheckingKing =
                (isWhiteKingInCheck && whiteKingPos && whiteKingPos[0] === r && whiteKingPos[1] === c) ||
                (isBlackKingInCheck && blackKingPos && blackKingPos[0] === r && blackKingPos[1] === c)

              return (
                <div
                  key={`${r}-${c}`}
                  className={[
                    styles.square,
                    isLight ? styles.light : styles.dark,
                    isSel ? styles.selected : '',
                    isCheckingKing ? styles.inCheckSquare : '',
                    isValid && !isCapture ? styles.validMove : '',
                    isCapture ? styles.captureTarget : '',
                  ].join(' ')}
                  onClick={() => handleClick(r, c)}
                >
                  {c === 0 && <span className={styles.coordRank}>{RANKS[r]}</span>}
                  {r === 7 && <span className={styles.coordFile}>{FILES[c]}</span>}

                  {piece && (
                    <span className={isWhite(piece) ? styles.pieceWhite : styles.pieceBlack}>
                      {PIECES[piece]}
                    </span>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Modal Phong Cấp Tốt FIDE */}
        {pendingPromotion && (
          <div className={styles.promotionOverlay}>
            <div className={styles.promotionTitle}>Chọn quân để phong cấp (Promotion):</div>
            <div className={styles.promotionOptions}>
              {['q', 'r', 'b', 'n'].map(type => (
                <button
                  key={type}
                  className={styles.promotionPieceBtn}
                  onClick={() => handlePromotionSelect(type)}
                >
                  <span className={turn === 'white' ? styles.pieceWhite : styles.pieceBlack}>
                    {PIECES[turn === 'white' ? type.toUpperCase() : type]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Bar */}
      <div className={styles.bottomBar}>
        <div className={styles.capturedArea}>
          <div className={styles.capturedGroup}>
            {captured.white.map((p, i) => (
              <span key={i} className={styles.pieceBlack}>{PIECES[p]}</span>
            ))}
          </div>
          <div className={styles.capturedGroup}>
            {captured.black.map((p, i) => (
              <span key={i} className={styles.pieceWhite}>{PIECES[p]}</span>
            ))}
          </div>
        </div>

        <button className={styles.btn} onClick={resetGame}>
          Ván Mới
        </button>
      </div>
    </div>
  )
}

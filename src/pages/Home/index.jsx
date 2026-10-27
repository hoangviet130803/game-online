import { Link } from 'react-router-dom'
import styles from './Home.module.css'

const GAMES = [
  {
    path: '/co-tuong',
    title: 'Cờ Tướng (Xiangqi)',
    tags: ['Có chế độ đấu với AI', '9x10 Sở Hà Hán Giới'],
    desc: 'Đầy đủ luật Tướng, Sĩ, Tượng, Xe, Pháo, Mã, Tốt. AI tự động tính toán nước đi cản chân, nhảy ngòi.',
    themeTint: 'rgba(239, 68, 68, 0.4)',
    themeAccent: '#dc2626',
    renderMockup: () => (
      <div className={styles.xiangqiMockup}>
        <div className={styles.xqPieceR}>帥</div>
        <div className={styles.xqVs}>SỞ HÀ</div>
        <div className={styles.xqPieceB}>將</div>
      </div>
    ),
  },
  {
    path: '/co-vua',
    title: 'Cờ Vua (Chess)',
    tags: ['Có chế độ đấu với AI', '64 Ô Vuông Chuẩn'],
    desc: 'Giao diện bàn cờ thi đấu tiêu chuẩn quốc tế. AI tính toán giá trị quân cờ, kiểm soát trung tâm và phong Hậu.',
    themeTint: 'rgba(99, 102, 241, 0.4)',
    themeAccent: '#6366f1',
    renderMockup: () => (
      <div className={styles.chessMockup}>
        <div className={styles.chessCellL}>♜</div>
        <div className={styles.chessCellD}>♞</div>
        <div className={styles.chessCellL}>♝</div>
        <div className={styles.chessCellD}>♛</div>
        <div className={styles.chessCellD}>♟</div>
        <div className={styles.chessCellL}>♟</div>
        <div className={styles.chessCellD}>♟</div>
        <div className={styles.chessCellL}>♟</div>
        <div className={styles.chessCellL}></div>
        <div className={styles.chessCellD}></div>
        <div className={styles.chessCellL}></div>
        <div className={styles.chessCellD}></div>
        <div className={styles.chessCellD}>♙</div>
        <div className={styles.chessCellL}>♙</div>
        <div className={styles.chessCellD}>♙</div>
        <div className={styles.chessCellL}>♙</div>
      </div>
    ),
  },
  {
    path: '/co-vay',
    title: 'Cờ Vây (Go / Baduk)',
    tags: ['Có chế độ đấu với AI', '9x9 & 13x13'],
    desc: 'Thuật toán tìm nhóm quân liền kề, tính Khí thời gian thực. AI biết cứu quân, siết khí và vây bắt.',
    themeTint: 'rgba(16, 185, 129, 0.4)',
    themeAccent: '#059669',
    renderMockup: () => (
      <div className={styles.goMockup}>
        <div className={styles.goCell}><div className={styles.goStoneB}></div></div>
        <div className={styles.goCell}></div>
        <div className={styles.goCell}><div className={styles.goStoneW}></div></div>
        <div className={styles.goCell}></div>
        <div className={styles.goCell}><div className={styles.goStoneB}></div></div>
        <div className={styles.goCell}></div>
        <div className={styles.goCell}><div className={styles.goStoneW}></div></div>
        <div className={styles.goCell}></div>
        <div className={styles.goCell}><div className={styles.goStoneB}></div></div>
      </div>
    ),
  },
]

export default function Home() {
  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.topBar}>
          <div className={styles.brand}>
            <div className={styles.brandIcon}>♟</div>
            <span className={styles.brandName}>Kỳ Đạo Quán</span>
          </div>
          <div className={styles.statusPill}>
            <span className={styles.liveDot} />
            <span>Đã tích hợp chế độ đấu với AI</span>
          </div>
        </div>

        <div className={styles.heroContent}>
          <h1 className={styles.mainTitle}>
            Bộ 3 Trò Chơi Cờ Trí Tuệ Kinh Điển
          </h1>
          <p className={styles.subTitle}>
            Hỗ trợ chế độ Đấu với Máy (AI) và 2 Người chơi (PvP). Ô cờ vuông chuẩn xác, mượt mà trên mọi thiết bị.
          </p>
        </div>
      </header>

      {/* Section Header */}
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Bàn Cờ Trực Tuyến</h2>
        <span className={styles.sectionCount}>3 trò chơi</span>
      </div>

      {/* Grid Cards */}
      <main className={styles.grid}>
        {GAMES.map(g => (
          <Link
            key={g.path}
            to={g.path}
            className={styles.card}
            style={{
              '--theme-tint': g.themeTint,
              '--theme-accent': g.themeAccent,
            }}
          >
            {/* Visual Board Mockup Area */}
            <div className={styles.previewArea}>
              {g.renderMockup()}
            </div>

            {/* Card Content */}
            <div className={styles.cardBody}>
              <div className={styles.tagRow}>
                {g.tags.map((t, idx) => (
                  <span key={idx} className={styles.tag}>{t}</span>
                ))}
              </div>
              <h3 className={styles.cardTitle}>{g.title}</h3>
              <p className={styles.cardDesc}>{g.desc}</p>
              
              <div className={styles.cardAction}>
                <span className={styles.actionLabel}>Vào chơi ngay</span>
                <div className={styles.arrowIcon}>→</div>
              </div>
            </div>
          </Link>
        ))}
      </main>

      {/* Footer */}
      <footer className={styles.footer}>
        <span>© 2026 Kỳ Đạo Quán · Nền tảng cờ trực tuyến</span>
        <span>Phát triển trên React & Vite</span>
      </footer>
    </div>
  )
}

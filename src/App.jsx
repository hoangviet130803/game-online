import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import CoVua from './pages/CoVua'
import CoTuong from './pages/CoTuong'
import CoVay from './pages/CoVay'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/co-vua" element={<CoVua />} />
      <Route path="/co-tuong" element={<CoTuong />} />
      <Route path="/co-vay" element={<CoVay />} />
    </Routes>
  )
}

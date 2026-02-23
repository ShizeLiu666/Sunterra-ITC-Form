import { BrowserRouter, Routes, Route } from 'react-router-dom'
import FormFill from './pages/FormFill'
import Preview from './pages/Preview'
import NetworkStatus from './components/NetworkStatus'

function App() {
  return (
    <BrowserRouter>
      <NetworkStatus />
      <Routes>
        <Route path="/" element={<FormFill />} />
        <Route path="/preview" element={<Preview />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App

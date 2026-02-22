import { BrowserRouter, Routes, Route } from 'react-router-dom'
import FormFill from './pages/FormFill'
import Preview from './pages/Preview'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<FormFill />} />
        <Route path="/preview" element={<Preview />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App

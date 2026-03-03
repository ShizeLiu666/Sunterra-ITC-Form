import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import FormFill from './pages/FormFill'
import Preview from './pages/Preview'
import VariationOrder from './pages/VariationOrder'
import VariationOrderPreview from './pages/VariationOrderPreview'
import NetworkStatus from './components/NetworkStatus'

function App() {
  return (
    <BrowserRouter>
      <NetworkStatus />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/itr" element={<FormFill />} />
        <Route path="/itr/preview" element={<Preview />} />
        <Route path="/variation-order" element={<VariationOrder />} />
        <Route path="/variation-order/preview" element={<VariationOrderPreview />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App

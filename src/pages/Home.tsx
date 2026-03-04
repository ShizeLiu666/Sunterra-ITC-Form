import { useNavigate } from 'react-router-dom'
import sunteraLogo from '../assets/Sunterra_Logo.png'
import { STORAGE_KEY } from '../shared/formData'
import { VARIATION_ORDER_STORAGE_KEY } from '../shared/variationOrderData'
import './Home.css'

export default function Home() {
  const navigate = useNavigate()
  const hasItrDraft = !!localStorage.getItem(STORAGE_KEY)
  const hasVoDraft = !!localStorage.getItem(VARIATION_ORDER_STORAGE_KEY)

  return (
    <div className="home-container">
      <header className="home-header">
        <img src={sunteraLogo} alt="Sunterra Energy" className="home-logo" />
        <h1 className="home-title">Sunterra Field Forms</h1>
      </header>

      <main className="home-cards">
        <button className="home-card" onClick={() => navigate('/itr')}>
          <div className="home-card-content">
            <div className="home-card-title">Installation Test Record</div>
            <div className="home-card-subtitle">Inspection, testing &amp; sign-off</div>
            {hasItrDraft && <div className="home-card-draft">Draft in progress</div>}
          </div>
          <div className="home-card-arrow">›</div>
        </button>

        <button className="home-card" onClick={() => navigate('/variation-order')}>
          <div className="home-card-content">
            <div className="home-card-title">Variation Order</div>
            <div className="home-card-subtitle">Extra work authorisation</div>
            {hasVoDraft && <div className="home-card-draft">Draft in progress</div>}
          </div>
          <div className="home-card-arrow">›</div>
        </button>
      </main>

      <footer className="home-footer">
        Sunterra Energy — Digital Forms v1.0
        <br />
        <span className="home-footer-build">Last updated: March 2026</span>
      </footer>
    </div>
  )
}

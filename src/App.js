import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import './App.css';
import Chatbot from './Chatbot';
import Landing from './Landing';

function Home() {
  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <div className="logo-section">
            <h1 className="logo">SRJC</h1>
            <span className="tagline">Santa Rosa Junior College</span>
          </div>
        </div>
      </header>

      <main className="main">
        <div className="hero-section">
          <div className="hero-content">
            <h1 className="hero-title">Pathways Finder</h1>
            <p className="hero-subtitle">Discover your academic journey and career path at SRJC</p>
            <div className="search-container">
              {/* <input 
                type="text" 
                placeholder="Search for programs, careers, or interests..."
                className="search-input"
              /> */}
              <Link to="/chatbot" className="search-button">Explore Pathways</Link>
            </div>
          </div>
        </div>

        <section className="features">
          <div className="feature-grid">
            <div className="feature-card">
              <div className="feature-icon">🎓</div>
              <h3>Academic Programs</h3>
              <p>Explore degree and certificate programs tailored to your goals</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">💼</div>
              <h3>Career Pathways</h3>
              <p>Connect your education to real-world career opportunities</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🗺️</div>
              <h3>Transfer Planning</h3>
              <p>Plan your path to four-year universities and beyond</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/chatbot" element={<Chatbot />} />
        <Route path="/landing" element={<Landing />} />
      </Routes>
    </Router>
  );
}

export default App;
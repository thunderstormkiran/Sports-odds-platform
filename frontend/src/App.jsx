import axios from 'axios';
import { Trophy, Clock, Star, MessageSquare, LogIn, UserPlus, AlertTriangle, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import './index.css';
import { useEffect, useState } from 'react';

const API_BASE = (import.meta.env.VITE_API_BASE || 'http://localhost:5000') + '/api';

const App = () => {
  const [matches, setMatches] = useState([]);
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')));
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [favorites, setFavorites] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchMatches();
    if (token) fetchFavorites();
  }, [token]);

  const fetchMatches = async () => {
    try {
      const res = await axios.get(`${API_BASE}/matches`);
      setMatches(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchFavorites = async () => {
    try {
      const res = await axios.get(`${API_BASE}/favorites`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFavorites(res.data.map(f => f.id));
    } catch (e) {
      console.error(e);
    }
  };

  const toggleFavorite = async (matchId) => {
    if (!token) return alert('Please login to save favorites');
    try {
      await axios.post(`${API_BASE}/favorites`, { matchId }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchFavorites();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="App">
      <header className="header">
        <h1>SPORTS ODDS INTELLIGENCE</h1>
        <p>AI-Powered Real-time Predictions</p>
        <div style={{ marginTop: '1rem' }}>
          {user ? (
            <span>Welcome, <strong>{user.username}</strong> | <button className="btn-primary" style={{padding: '5px 10px'}} onClick={() => { localStorage.clear(); window.location.reload(); }}>Logout</button></span>
          ) : (
            <span>Login to track favorites</span>
          )}
        </div>
      </header>

      <main className="match-grid">
        {isLoading ? (
          <div style={{gridColumn: '1/-1', textAlign: 'center'}}>Calculating AI Odds...</div>
        ) : matches.map(match => (
          <MatchCard 
            key={match.id} 
            match={match} 
            isFavorite={favorites.includes(match.id)}
            onToggleFavorite={() => toggleFavorite(match.id)}
          />
        ))}
      </main>

      <AIWhisperer matches={matches} />
      {!user && <AuthForm onLogin={(u, t) => { setUser(u); setToken(t); }} />}
    </div>
  );
};

const MatchCard = ({ match, isFavorite, onToggleFavorite }) => {
  const getRiskColor = (risk) => {
    switch(risk) {
      case 'Low': return '#10b981'; // Green
      case 'Moderate': return '#f59e0b'; // Amber
      case 'High': return '#f43f5e'; // Rose
      default: return 'var(--primary)';
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      className="glass-card" 
      style={{ padding: '1.5rem', position: 'relative' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span className="league-badge">{match.league.toUpperCase()}</span>
          {match.risk_level && (
            <span style={{ 
              fontSize: '0.65rem', 
              padding: '2px 8px', 
              borderRadius: '20px', 
              background: `${getRiskColor(match.risk_level)}22`,
              color: getRiskColor(match.risk_level),
              border: `1px solid ${getRiskColor(match.risk_level)}44`,
              fontWeight: 'bold'
            }}>
              {match.risk_level.toUpperCase()} RISK
            </span>
          )}
        </div>
        <Star 
          size={20} 
          fill={isFavorite ? 'var(--primary)' : 'none'} 
          stroke={isFavorite ? 'var(--primary)' : '#fff'} 
          style={{ cursor: 'pointer' }}
          onClick={onToggleFavorite}
        />
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#fff' }}>{match.team_a}</div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', marginTop: '4px' }}>{match.team_a_rating} RTG</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ color: 'var(--accent)', fontWeight: '900', fontSize: '0.8rem' }}>VS</div>
            <div style={{ height: '20px', width: '1px', background: 'rgba(255,255,255,0.1)', margin: '4px 0' }}></div>
        </div>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#fff' }}>{match.team_b}</div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', marginTop: '4px' }}>{match.team_b_rating} RTG</div>
        </div>
      </div>

      {match.odds ? (
        <>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <div className="odds-badge">
              <div style={{ fontSize: '0.6rem', opacity: 0.5 }}>{match.team_a}</div>
              <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{match.odds.teamA}</div>
            </div>
            <div className="odds-badge" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <div style={{ fontSize: '0.6rem', opacity: 0.5 }}>DRAW</div>
              <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{match.odds.draw}</div>
            </div>
            <div className="odds-badge">
              <div style={{ fontSize: '0.6rem', opacity: 0.5 }}>{match.team_b}</div>
              <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{match.odds.teamB}</div>
            </div>
          </div>
          
          <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', marginBottom: '4px' }}>
                  <span style={{ opacity: 0.6 }}>AI CONFIDENCE: <strong style={{ color: 'var(--primary)' }}>{match.confidence}%</strong></span>
                  <span style={{ opacity: 0.6 }}>PROBABILITY</span>
              </div>
              <div className="prob-bar-container">
                <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${match.probabilities.teamA * 100}%` }}
                    className="prob-bar" 
                ></motion.div>
              </div>
          </div>
        </>
      ) : (
        <div className="match-offline-status">
            <AlertTriangle size={16} /> DATA STREAM OFFLINE
        </div>
      )}

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem', marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0.5, fontSize: '0.7rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Clock size={12} /> {new Date(match.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
        </div>
        <div>STAKE RATIO: 1.4:1</div>
      </div>
    </motion.div>
  );
};

const AIWhisperer = ({ matches }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState([{ sender: 'AI', text: 'Ask me anything about these matches!' }]);

  const handleSend = async () => {
    if (!query) return;
    const userMsg = { sender: 'User', text: query };
    setMessages([...messages, userMsg]);
    setQuery('');

    try {
      const res = await axios.post(`${API_BASE}/agent/query`, {
        query,
        context: matches.map(m => ({ teamA: m.team_a, teamB: m.team_b, probabilities: m.probabilities }))
      });
      setMessages(prev => [...prev, { sender: 'AI', text: res.data.answer }]);
    } catch {
      setMessages(prev => [...prev, { sender: 'AI', text: 'Error connecting to brain.' }]);
    }
  };

  return (
    <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 1000 }}>
      <button 
        className="glass-card" 
        style={{ width: '60px', height: '60px', borderRadius: '30px', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <MessageSquare />
      </button>
      
      {isOpen && (
        <div className="glass-card" style={{ position: 'absolute', bottom: '80px', right: 0, width: '320px', height: '400px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', fontWeight: 'bold' }}>AI Match Insight</div>
          <div style={{ flex: 1, padding: '1rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {messages.map((m, i) => (
              <div key={i} style={{ alignSelf: m.sender === 'AI' ? 'flex-start' : 'flex-end', background: m.sender === 'AI' ? 'rgba(255,255,255,0.1)' : 'var(--secondary)', padding: '8px 12px', borderRadius: '12px', fontSize: '0.9rem', maxWidth: '80%', color: m.sender === 'AI' ? '#fff' : '#000' }}>
                {m.text}
              </div>
            ))}
          </div>
          <div style={{ padding: '1rem', display: 'flex', gap: '0.5rem', background: 'rgba(0,0,0,0.2)' }}>
            <input 
              type="text" 
              value={query} 
              onChange={e => setQuery(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && handleSend()}
              style={{ flex: 1, background: 'none', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '8px', borderRadius: '4px' }}
              placeholder="Ask AI..."
            />
            <button className="btn-primary" onClick={handleSend}>SR</button>
          </div>
        </div>
      )}
    </div>
  );
};

const AuthForm = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/register';
      const res = await axios.post(`${API_BASE}${endpoint}`, { username, password });
      if (isLogin) {
        localStorage.setItem('token', res.data.accessToken);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        onLogin(res.data.user, res.data.accessToken);
      } else {
        alert('Registered successfully! Now login.');
        setIsLogin(true);
      }
    } catch (e) {
      alert(e.response?.data?.error || 'Auth failed');
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <form className="glass-card" style={{ padding: '2rem', width: '300px' }} onSubmit={handleSubmit}>
        <h2 style={{ textAlign: 'center' }}>{isLogin ? 'Login' : 'Register'}</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <input type="text" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} style={{ padding: '10px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }} />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} style={{ padding: '10px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }} />
          <button className="btn-primary" type="submit">{isLogin ? 'Login' : 'Register'}</button>
          <p style={{ textAlign: 'center', fontSize: '0.8rem', cursor: 'pointer' }} onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? "Don't have an account? Register" : "Already have an account? Login"}
          </p>
        </div>
      </form>
    </div>
  );
};

export default App;

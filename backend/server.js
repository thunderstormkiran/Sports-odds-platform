const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:5001';

// --- CACHE SETUP ---
const oddsCache = new Map(); // Simple cache to store AI results
const CACHE_TTL = 5 * 60 * 1000; // 5 minute cache

// DB Connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// --- MOCK DB FALLBACK ---
let dbOnline = false;
const mockUsers = [
  { id: 1, username: 'admin', password_hash: '$2a$10$pL/zN23wIs.Tf6.YqX/TxeWz7r726Z6n5xXo7R5N3B1W.YqX/Txe.' } // password: admin
];
const mockFavorites = []; // { user_id, match_id }
let mockMatchData = [
    { id: 1, team_a: 'Man City', team_b: 'Liverpool', team_a_rating: 92, team_b_rating: 89, sport: 'Soccer', league: 'EPL', start_time: new Date() },
    { id: 2, team_a: 'Arsenal', team_b: 'Chelsea', team_a_rating: 88, team_b_rating: 75, sport: 'Soccer', league: 'EPL', start_time: new Date() },
    { id: 3, team_a: 'Lakers', team_b: 'Warriors', team_a_rating: 82, team_b_rating: 85, sport: 'Basketball', league: 'NBA', start_time: new Date() }
];

pool.connect((err, client, release) => {
  if (err) {
    console.warn('⚠️  PostgreSQL connection failed. Switching to IN-MEMORY MOCK DATABASE.');
    dbOnline = false;
  } else {
    console.log('✅ Connected to PostgreSQL');
    dbOnline = true;
    release();
  }
});

// Middleware for JWT Verification
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// --- AUTH ROUTES ---
app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  
  if (!dbOnline) {
    const newUser = { id: mockUsers.length + 1, username, password_hash: hashedPassword };
    mockUsers.push(newUser);
    return res.status(201).json({ id: newUser.id, username: newUser.username });
  }

  try {
    const result = await pool.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username',
      [username, hashedPassword]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: 'Username already exists' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!dbOnline) {
    const user = mockUsers.find(u => u.username === username);
    if (!user) return res.status(400).json({ error: 'User not found (Mock DB)' });
    
    if (await bcrypt.compare(password, user.password_hash)) {
      const accessToken = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET);
      return res.json({ accessToken, user: { id: user.id, username: user.username } });
    }
    return res.status(403).json({ error: 'Invalid password' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) return res.status(400).json({ error: 'User not found' });
    
    const user = result.rows[0];
    if (await bcrypt.compare(password, user.password_hash)) {
      const accessToken = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET);
      res.json({ accessToken, user: { id: user.id, username: user.username } });
    } else {
      res.status(403).json({ error: 'Invalid password' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// --- MATCHES & ODDS ---
app.get('/api/matches', async (req, res) => {
  try {
    let matches = [];
    if (dbOnline) {
        const matchesResult = await pool.query('SELECT * FROM matches');
        matches = matchesResult.rows;
    } else {
        matches = mockMatchData;
    }

    // Call Python AI Service for each match
    const matchesWithOdds = await Promise.all(matches.map(async (match) => {
      const cacheKey = `${match.team_a}_${match.team_b}_${match.team_a_rating}_${match.team_b_rating}`;
      const cached = oddsCache.get(cacheKey);
      
      if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        return { ...match, ...cached.data };
      }

      try {
        const response = await axios.post(`${AI_SERVICE_URL}/generate-odds`, {
          teamA: match.team_a,
          teamB: match.team_b,
          teamA_rating: match.team_a_rating,
          teamB_rating: match.team_b_rating
        });
        
        const oddsData = {
          odds: response.data.odds,
          probabilities: {
            teamA: response.data.teamA_win_prob,
            teamB: response.data.teamB_win_prob,
            draw: response.data.draw_prob
          },
          risk_level: response.data.risk_level,
          confidence: response.data.confidence
        };

        // Update cache
        oddsCache.set(cacheKey, { data: oddsData, timestamp: Date.now() });

        return {
          ...match,
          ...oddsData
        };
      } catch (e) {
        return { ...match, odds: null, error: 'AI Service Offline' };
      }
    }));

    res.json(matchesWithOdds);
  } catch (err) {
    console.error('Route error:', err.message);
    res.status(500).json({ error: 'Failed to fetch matches' });
  }
});

// --- FAVORITES ---
app.get('/api/favorites', authenticateToken, async (req, res) => {
  if (!dbOnline) {
    const userFavs = mockFavorites
        .filter(f => f.user_id === req.user.id)
        .map(f => mockMatchData.find(m => m.id === f.match_id));
    return res.json(userFavs.filter(Boolean));
  }
  
  try {
    const result = await pool.query(
      'SELECT m.* FROM matches m JOIN favorites f ON m.id = f.match_id WHERE f.user_id = $1',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'DB Error' });
  }
});

app.post('/api/favorites', authenticateToken, async (req, res) => {
  const { matchId } = req.body;

  if (!dbOnline) {
    const exists = mockFavorites.find(f => f.user_id === req.user.id && f.match_id === matchId);
    if (!exists) mockFavorites.push({ user_id: req.user.id, match_id: matchId });
    return res.sendStatus(201);
  }

  try {
    await pool.query('INSERT INTO favorites (user_id, match_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [req.user.id, matchId]);
    res.sendStatus(201);
  } catch (err) {
    res.status(500).json({ error: 'DB Error' });
  }
});

// --- AI AGENT ---
app.post('/api/agent/query', async (req, res) => {
  const { query, context } = req.body;
  try {
    const response = await axios.post(`${AI_SERVICE_URL}/agent/query`, { query, context });
    res.json(response.data);
  } catch (e) {
    res.json({ answer: "I'm having trouble connecting to my reasoning engine. Generally, higher ratings lead to lower odds." });
  }
});

app.listen(PORT, () => {
  console.log(`Backend Server running on port ${PORT}`);
});

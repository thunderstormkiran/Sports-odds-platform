-- Sports Odds Intelligence Platform Schema

-- Drop existing tables if they exist
DROP TABLE IF EXISTS favorites;
DROP TABLE IF EXISTS matches;
DROP TABLE IF EXISTS users;

-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Matches table (Initial data without odds)
CREATE TABLE matches (
    id SERIAL PRIMARY KEY,
    sport VARCHAR(50) NOT NULL,
    league VARCHAR(100) NOT NULL,
    team_a VARCHAR(100) NOT NULL,
    team_b VARCHAR(100) NOT NULL,
    team_a_rating INTEGER NOT NULL, -- Rating (score 0-100)
    team_b_rating INTEGER NOT NULL, -- Rating (score 0-100)
    start_time TIMESTAMP NOT NULL
);

-- Favorites table
CREATE TABLE favorites (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    match_id INTEGER REFERENCES matches(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, match_id)
);

-- Mock Match Data
INSERT INTO matches (sport, league, team_a, team_b, team_a_rating, team_b_rating, start_time) VALUES
('Soccer', 'Premier League', 'Manchester City', 'Liverpool', 92, 89, NOW() + INTERVAL '2 hours'),
('Soccer', 'Premier League', 'Arsenal', 'Chelsea', 88, 75, NOW() + INTERVAL '5 hours'),
('Basketball', 'NBA', 'LA Lakers', 'Golden State Warriors', 82, 85, NOW() + INTERVAL '10 hours'),
('Tennis', 'ATP', 'Novak Djokovic', 'Carlos Alcaraz', 95, 93, NOW() + INTERVAL '1 day'),
('Cricket', 'IPL', 'Mumbai Indians', 'Chennai Super Kings', 85, 87, NOW() + INTERVAL '3 hours'),
('Basketball', 'NBA', 'Boston Celtics', 'Miami Heat', 90, 80, NOW() + INTERVAL '12 hours');

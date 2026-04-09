import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import math

class OddsGenerator:
    @staticmethod
    def calculate_probabilities(rating_a, rating_b):
        # A simple Elo-inspired formula for win probability
        # Prob = 1 / (1 + 10^((RatingB - RatingA) / 40))
        # Here we use a simpler version for demonstration
        
        diff = rating_a - rating_b
        # Normalize diff to a probability
        # Using a sigmoid function
        prob_a = 1 / (1 + math.exp(-diff / 15))
        
        # Add basic draw probability (approx 20-30% in soccer, less in others)
        draw_prob = 0.20 * (1 - abs(prob_a - 0.5) * 2) # More likely if teams are close
        
        # Readjust win probs to account for draw
        remaining = 1.0 - draw_prob
        adj_prob_a = prob_a * remaining
        adj_prob_b = (1 - prob_a) * remaining
        
        # Round to 2 decimal places
        return {
            "teamA_win_prob": round(adj_prob_a, 2),
            "teamB_win_prob": round(adj_prob_b, 2),
            "draw_prob": round(draw_prob, 2)
        }

    @staticmethod
    def calculate_risk(prob_a, prob_b, draw_prob):
        # High risk if outcomes are very close, lower risk if there's a clear favorite
        max_prob = max(prob_a, prob_b, draw_prob)
        if max_prob > 0.65: return "Low", 95
        if max_prob > 0.5: return "Moderate", 80
        if max_prob > 0.4: return "Average", 65
        return "High", 40

    @staticmethod
    def prob_to_decimal_odds(prob):
        if prob <= 0: return 99.0
        return round(1 / prob, 2)

class AIHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path == '/generate-odds':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data)
            
            team_a = data.get('teamA', 'Team A')
            team_b = data.get('teamB', 'Team B')
            rating_a = data.get('teamA_rating', 50)
            rating_b = data.get('teamB_rating', 50)
            
            probs = OddsGenerator.calculate_probabilities(rating_a, rating_b)
            risk_level, confidence = OddsGenerator.calculate_risk(probs["teamA_win_prob"], probs["teamB_win_prob"], probs["draw_prob"])
            
            response = {
                "teamA": team_a,
                "teamB": team_b,
                "teamA_win_prob": probs["teamA_win_prob"],
                "teamB_win_prob": probs["teamB_win_prob"],
                "draw_prob": probs["draw_prob"],
                "risk_level": risk_level,
                "confidence": confidence,
                "odds": {
                    "teamA": OddsGenerator.prob_to_decimal_odds(probs["teamA_win_prob"]),
                    "teamB": OddsGenerator.prob_to_decimal_odds(probs["teamB_win_prob"]),
                    "draw": OddsGenerator.prob_to_decimal_odds(probs["draw_prob"])
                }
            }
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(response).encode())
            
        elif self.path == '/agent/query':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data)
            
            query = data.get('query', '').lower()
            context = data.get('context', []) # Recent matches + odds
            
            # Enhanced Agent logic
            answer = "Analysing market data..."
            if "win" in query or "favorite" in query or "best" in query:
                if context:
                    # Sort matches by winning probability
                    best = max(context, key=lambda x: x.get('probabilities', {}).get('teamA', 0) if x.get('probabilities') else 0)
                    answer = f"The smartest play is looking like {best['teamA']}. My model gives them a {round(best['probabilities']['teamA']*100)}% edge. "
                    if best['probabilities']['teamA'] > 0.6:
                        answer += "It's a high-confidence prediction."
                    else:
                        answer += "However, it's a tight match, so maintain caution."
                else:
                    answer = "I'm currently observing neutral market trends. Keep an eye on the EPL match-ups for high-volatility opportunities."
            elif "close" in query or "tight" in query or "even" in query:
                if context:
                    def spread(m):
                        p = m.get('probabilities') or {}
                        return abs((p.get('teamA') or 0) - (p.get('teamB') or 0))
                    closest = min(context, key=spread)
                    p = closest.get('probabilities') or {}
                    answer = (
                        f"The closest match-up is {closest['teamA']} vs {closest['teamB']} — "
                        f"win probabilities {round((p.get('teamA') or 0)*100)}% vs {round((p.get('teamB') or 0)*100)}%. "
                        "Expect volatility."
                    )
                else:
                    answer = "No match data available to compare odds right now."
            elif "predictable" in query or "certain" in query or "safe" in query:
                if context:
                    def confidence(m):
                        p = m.get('probabilities') or {}
                        return max((p.get('teamA') or 0), (p.get('teamB') or 0))
                    pick = max(context, key=confidence)
                    p = pick.get('probabilities') or {}
                    edge = round(max((p.get('teamA') or 0), (p.get('teamB') or 0)) * 100)
                    answer = (
                        f"The most predictable match is {pick['teamA']} vs {pick['teamB']} — "
                        f"the model's leading side sits at {edge}% win probability."
                    )
                else:
                    answer = "I need match context to identify the most predictable game."
            elif "risk" in query:
                answer = "Risk is calculated based on the variance between team ratings. Higher rating gaps usually mean more stable predictions."
            else:
                answer = "I recommend monitoring matches where Draw odds exceed 4.0. My calculations suggest these often represent undervalued probabilities."

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"answer": answer}).encode())

def run(port=5000):
    server_address = ('', port)
    httpd = ThreadingHTTPServer(server_address, AIHandler)
    print(f"AI Service running on port {port}...")
    httpd.serve_forever()

if __name__ == '__main__':
    run(int(os.environ.get('PORT', 5001)))

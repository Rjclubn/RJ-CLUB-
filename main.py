
from flask import Flask, render_template, request, jsonify, session
from flask_socketio import SocketIO, emit
import random
import time
import threading
import uuid
from datetime import datetime

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-here'
socketio = SocketIO(app, cors_allowed_origins="*")

# Game state
current_game = {
    'period': 1,
    'status': 'betting',  # 'betting', 'waiting', 'result'
    'time_left': 30,
    'result': None,
    'bets': {}
}

users = {}

colors = ['red', 'green', 'violet']
numbers = list(range(10))

def get_color_for_number(num):
    if num == 0:
        return 'red_violet'
    elif num == 5:
        return 'green_violet'
    elif num in [1, 3, 7, 9]:
        return 'green'
    else:
        return 'red'

def game_timer():
    while True:
        if current_game['status'] == 'betting':
            if current_game['time_left'] > 0:
                current_game['time_left'] -= 1
                socketio.emit('timer_update', {
                    'time_left': current_game['time_left'],
                    'status': current_game['status']
                })
                time.sleep(1)
            else:
                # Betting time over, generate result
                current_game['status'] = 'waiting'
                result_number = random.randint(0, 9)
                result_color = get_color_for_number(result_number)
                current_game['result'] = {
                    'number': result_number,
                    'color': result_color
                }
                
                socketio.emit('game_result', current_game['result'])
                
                # Process bets and update balances
                process_bets()
                
                # Wait 5 seconds before starting new round
                time.sleep(5)
                
                # Start new round
                current_game['period'] += 1
                current_game['status'] = 'betting'
                current_game['time_left'] = 30
                current_game['result'] = None
                current_game['bets'] = {}
                
                socketio.emit('new_round', {'period': current_game['period']})

def process_bets():
    result = current_game['result']
    for user_id, user_bets in current_game['bets'].items():
        if user_id in users:
            for bet in user_bets:
                winnings = 0
                if bet['type'] == 'color':
                    if bet['choice'] == result['color'] or \
                       (bet['choice'] == 'violet' and 'violet' in result['color']):
                        if bet['choice'] == 'violet':
                            winnings = bet['amount'] * 4.5
                        else:
                            winnings = bet['amount'] * 2
                elif bet['type'] == 'number':
                    if bet['choice'] == result['number']:
                        winnings = bet['amount'] * 9
                
                users[user_id]['balance'] += winnings

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/join', methods=['POST'])
def join_game():
    username = request.json.get('username')
    user_id = str(uuid.uuid4())
    
    users[user_id] = {
        'username': username,
        'balance': 1000  # Starting balance
    }
    
    session['user_id'] = user_id
    
    return jsonify({
        'user_id': user_id,
        'balance': users[user_id]['balance'],
        'current_game': {
            'period': current_game['period'],
            'time_left': current_game['time_left'],
            'status': current_game['status']
        }
    })

@app.route('/place_bet', methods=['POST'])
def place_bet():
    user_id = session.get('user_id')
    if not user_id or user_id not in users:
        return jsonify({'error': 'User not found'}), 400
    
    if current_game['status'] != 'betting':
        return jsonify({'error': 'Betting is closed'}), 400
    
    bet_data = request.json
    amount = bet_data.get('amount')
    bet_type = bet_data.get('type')  # 'color' or 'number'
    choice = bet_data.get('choice')
    
    if users[user_id]['balance'] < amount:
        return jsonify({'error': 'Insufficient balance'}), 400
    
    # Deduct bet amount
    users[user_id]['balance'] -= amount
    
    # Add bet to current game
    if user_id not in current_game['bets']:
        current_game['bets'][user_id] = []
    
    current_game['bets'][user_id].append({
        'amount': amount,
        'type': bet_type,
        'choice': choice,
        'timestamp': datetime.now().isoformat()
    })
    
    return jsonify({
        'success': True,
        'new_balance': users[user_id]['balance']
    })

@app.route('/get_balance')
def get_balance():
    user_id = session.get('user_id')
    if not user_id or user_id not in users:
        return jsonify({'error': 'User not found'}), 400
    
    return jsonify({'balance': users[user_id]['balance']})

if __name__ == '__main__':
    # Start game timer in background
    timer_thread = threading.Thread(target=game_timer, daemon=True)
    timer_thread.start()
    
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)

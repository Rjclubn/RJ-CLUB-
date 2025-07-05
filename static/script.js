
let socket;
let currentBet = null;
let userBalance = 0;
let gameStatus = 'waiting';

// Initialize socket connection
function initSocket() {
    socket = io();
    
    socket.on('timer_update', function(data) {
        document.getElementById('timeLeft').textContent = data.time_left;
        
        if (data.status === 'betting') {
            gameStatus = 'betting';
            document.getElementById('gameStatus').textContent = 'Place your bets!';
            enableBetting();
        } else {
            gameStatus = 'waiting';
            document.getElementById('gameStatus').textContent = 'Waiting for result...';
            disableBetting();
        }
        
        // Update timer color
        const timer = document.querySelector('.timer');
        if (data.status === 'betting') {
            timer.classList.remove('waiting');
        } else {
            timer.classList.add('waiting');
        }
    });
    
    socket.on('game_result', function(data) {
        showResult(data);
        setTimeout(() => {
            updateBalance();
        }, 2000);
    });
    
    socket.on('new_round', function(data) {
        document.getElementById('period').textContent = data.period;
        clearResult();
        cancelBet();
    });
}

function joinGame() {
    const username = document.getElementById('usernameInput').value.trim();
    if (!username) {
        alert('Please enter a username');
        return;
    }
    
    fetch('/join', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: username })
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            alert(data.error);
            return;
        }
        
        document.getElementById('username').textContent = username;
        userBalance = data.balance;
        document.getElementById('balance').textContent = '₹' + userBalance;
        document.getElementById('period').textContent = data.current_game.period;
        
        document.getElementById('joinModal').style.display = 'none';
        document.getElementById('gameArea').style.display = 'block';
        
        initSocket();
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Failed to join game');
    });
}

function selectBet(button) {
    // Remove previous selections
    document.querySelectorAll('.bet-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
    
    // Select current button
    button.classList.add('selected');
    
    const type = button.dataset.type;
    const choice = button.dataset.choice;
    
    if (currentBet) {
        currentBet.type = type;
        currentBet.choice = choice;
        updateBetSummary();
    } else {
        currentBet = { type, choice, amount: 0 };
    }
}

function selectAmount(amount) {
    // Remove previous amount selections
    document.querySelectorAll('.amount-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
    
    // Clear custom amount
    document.getElementById('customAmount').value = '';
    
    if (!currentBet) {
        alert('Please select a color or number first');
        return;
    }
    
    currentBet.amount = amount;
    showConfirmBet();
}

function setCustomAmount() {
    const customAmount = parseInt(document.getElementById('customAmount').value);
    if (!customAmount || customAmount < 1) {
        alert('Please enter a valid amount');
        return;
    }
    
    if (!currentBet) {
        alert('Please select a color or number first');
        return;
    }
    
    if (customAmount > userBalance) {
        alert('Insufficient balance');
        return;
    }
    
    currentBet.amount = customAmount;
    showConfirmBet();
}

function showConfirmBet() {
    if (!currentBet || !currentBet.amount) return;
    
    updateBetSummary();
    document.getElementById('confirmBet').style.display = 'block';
}

function updateBetSummary() {
    if (!currentBet) return;
    
    let multiplier = 1;
    if (currentBet.type === 'color') {
        multiplier = currentBet.choice === 'violet' ? 4.5 : 2;
    } else if (currentBet.type === 'number') {
        multiplier = 9;
    }
    
    const potentialWin = currentBet.amount * multiplier;
    const summary = `Bet ₹${currentBet.amount} on ${currentBet.choice} - Win up to ₹${potentialWin}`;
    document.getElementById('betSummary').textContent = summary;
}

function confirmBet() {
    if (!currentBet || gameStatus !== 'betting') {
        alert('Cannot place bet at this time');
        return;
    }
    
    if (currentBet.amount > userBalance) {
        alert('Insufficient balance');
        return;
    }
    
    fetch('/place_bet', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(currentBet)
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            alert(data.error);
            return;
        }
        
        userBalance = data.new_balance;
        document.getElementById('balance').textContent = '₹' + userBalance;
        document.getElementById('gameStatus').textContent = 'Bet placed successfully!';
        
        cancelBet();
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Failed to place bet');
    });
}

function cancelBet() {
    currentBet = null;
    document.getElementById('confirmBet').style.display = 'none';
    document.querySelectorAll('.bet-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
    document.querySelectorAll('.amount-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
    document.getElementById('customAmount').value = '';
}

function showResult(result) {
    const resultNumber = document.getElementById('resultNumber');
    const resultColor = document.getElementById('resultColor');
    
    resultNumber.textContent = result.number;
    resultColor.className = 'result-color ' + result.color;
    
    // Add celebration animation
    document.querySelector('.result-area').classList.add('celebration');
    setTimeout(() => {
        document.querySelector('.result-area').classList.remove('celebration');
    }, 500);
}

function clearResult() {
    document.getElementById('resultNumber').textContent = '?';
    document.getElementById('resultColor').className = 'result-color';
}

function updateBalance() {
    fetch('/get_balance')
    .then(response => response.json())
    .then(data => {
        if (!data.error) {
            userBalance = data.balance;
            document.getElementById('balance').textContent = '₹' + userBalance;
        }
    });
}

function enableBetting() {
    document.querySelector('.betting-area').classList.remove('disabled');
}

function disableBetting() {
    document.querySelector('.betting-area').classList.add('disabled');
    cancelBet();
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Bet selection buttons
    document.querySelectorAll('.bet-btn').forEach(button => {
        button.addEventListener('click', () => selectBet(button));
    });
    
    // Amount buttons
    document.querySelectorAll('.amount-btn').forEach(button => {
        button.addEventListener('click', () => {
            button.classList.add('selected');
            selectAmount(parseInt(button.dataset.amount));
        });
    });
    
    // Custom amount input
    document.getElementById('customAmount').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            setCustomAmount();
        }
    });
    
    // Join game on Enter key
    document.getElementById('usernameInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            joinGame();
        }
    });
});

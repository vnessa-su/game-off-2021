/*
Types of cells:
-1 : empty cell
0-5: Actual resource -- [B]ranch [F]ruit [L]eaf [R]ock [S]hell [T]hread
6-11: Tentative resource

Coin States:

-1: empty
0: tentative coin
1: actual coin
*/

function reload() {
    newGame();
    gameState = getGameStateAscii();

    var container = document.getElementById("board");
    container.innerHTML = gameState.board;
}

function validateState() {
    state = getState();
    board = state.board;
    deck = state.deck;
    hand = state.hand;

    //First checking cards on board. Counting tentative cells and real cells.
    numTentatives = 0;
    numReals = 0;
    tentativeCell1X, tentativeCell1Y, tentativeCell2X, tentativeCell2Y = 0;

    for (let x = 0; x < 7; x++) {
        for (let y = 0; y < 7; y++) {
            if (board[x][y].type >= 0 && board[x][y].type <= 5) {
                numReals++;
            }

            if (board[x][y].type > 5) {

                // Keep track of the first two tentative cells we find, so we can refer to them later.
                if (numTentatives == 0) {
                    tentativeCell1X = x;
                    tentativeCell1Y = y;
                }

                if (numTentatives == 1) {
                    tentativeCell2X = x;
                    tentativeCell2Y = y;
                }
                numTentatives++;
            }
        }
    }

    // We should either be placing a card (2 tentative cells) or not (0 tentative cells). Error otherwise.
    if (!(numTentatives==0 || numTentatives==2)) {
        return {status: "ERROR", message: "Wrong number of tentatives"}
    }

    // We should have the right number of cards placed on board, with no overlaps. Can figure this out by how
    // many cards are left in the deck.
    cellsInDeckAndHand = (deck.length * 2) + (hand.length * 2);
    if (numReals + cellsInDeckAndHand != 72) {
        return {status: "INVALID", message: "Wrong number of cells. Did you try to place a card on top of another?"}
    }


    if (numTentatives == 2) {
        // We have the right number of tentative cells. Make sure those are valid.
        // First lets make sure they're both the same type.
        if (board[tentativeCell1X][tentativeCell1Y] != board[tentativeCell2X][tentativeCell2Y]) {
            return {status: "ERROR", message: "Tentative cells are of different types"}
        }

        // Next lets make sure they're next to each other.

        diffX = tentativeCell1X - tentativeCell2X;
        diffY = tentativeCell1Y - tentativeCell2Y;

        if (diffX * diffY != 0 || Math.abs(diffX + diffY) != 1) {
            return {status: "ERROR", message: "Tentative cells arent adjacent"}
        }

        // Now lets make sure they're not next to any other cells that are of the same (nontentative) type, but are
        // next to at least 1 existing card (unless its the first placement).

        realType = board[tentativeCell1X][tentativeCell1Y] - 6;
        nextToCard = false;
        for (let x = tentativeCell1X - 1; x < tentativeCell1X + 2; x++) {
            for (let y = tentativeCell1Y - 1; y < tentativeCell1Y + 2; y++) {
                if (x < 0) continue;
                if (y < 0) continue;
                if (x > 6) continue;
                if (y > 6) continue;
                if (x == y) continue;
                if (board[x][y].type == realType) {
                    return {status: "INVALID", message: "Card placed next to same type."}
                }
                if (board[x][y].type >= 0 && board[x][y].type <= 5) {
                    nextToCard = true;
                }
            }
        }

        for (let x = tentativeCell2X - 1; x < tentativeCell2X + 2; x++) {
            for (let y = tentativeCell2Y - 1; y < tentativeCell2Y + 2; y++) {
                if (x < 0) continue;
                if (y < 0) continue;
                if (x > 6) continue;
                if (y > 6) continue;
                if (x == y) continue;
                if (board[x][y].type == realType) {
                    return {status: "INVALID", message: "Card placed next to same type."}
                }
                if (board[x][y].type >= 0 && board[x][y].type <= 5) {
                    nextToCard = true;
                }
            }
        }

        if (numReals > 0 && !nextToCard) {
            return {status: "INVALID", message: "Card must be placed next to an existing card."}
        }
    }

    // Card placement looks good.
    // Next lets verify coin placement, similar logic.
    numTentatives = 0;
    numReals = 0;
    tentativeCells = []; //keys: 'x', 'y'

    // Getting counts of all coins and tentative coins. Also verifying all coins are on actual cards.
    for (let x = 0; x < 7; x++) {
        for (let y = 0; y < 7; y++) {
            if (board[x][y].coinstate == 1) {
                if (board[x][y].type < 0 || board[x][y].type > 5) {
                    return {status: "ERROR", message: "Found a placed coin not on a card."}
                }
                numReals++;
            }

            if (board[x][y].coinstate == 0) {
                if (board[x][y].type < 0 || board[x][y].type > 5) {
                    return {status: "INVALID", message: "Found a tentative coin not on a card."}
                }
                numTentatives++;
                tentativeCells.push({x: x, y: y});
            }
        }
    }

    // Each time a goal is satisfied, we get 6 coins. Make sure tentative coins are either 0 or 6, and real
    // coins are divisible by 6.
    if (!(numTentatives == 0 || numTentatives == 6)) {
        return {status: "INVALID", message: "Placed the wrong number of coins."}
    }

    if (numReals % 6 != 0) {
        return {status: "ERROR", message: "Wrong number of coins placed."}
    }

    // Need to check if all tentative coins are adjacent.
    // Need to check if all tentative coins fulfill a single goal.
}

function getGameStateAscii() {
    state = getState();

    boardAscii = ""
    board = state.board;

    for (let x = 0; x < 7; x++) {
        for (let y = 0; y < 7; y++) {
            boardAscii += ".BFLRSTbflrst".charAt(board[x][y].type+1)
        }
        boardAscii += "<br>";
    }

    return {"board":boardAscii};
}

function newGame() {
    board = createEmptyBoard();
    deck = createShuffledDeck();
    goals = createGoals();
    hand = [];

    state = {board: board, deck: deck, goals: goals, hand: hand}
    saveState(state);

    drawCard();
    drawCard();
}

function saveState(state) {
    window.sessionStorage.setItem('board', JSON.stringify(state.board));
    window.sessionStorage.setItem('deck', JSON.stringify(state.deck));
    window.sessionStorage.setItem('goals', JSON.stringify(state.goals));
    window.sessionStorage.setItem('hand', JSON.stringify(state.hand));
}

function getState() {
    board = JSON.parse(window.sessionStorage.getItem('board'));
    deck = JSON.parse(window.sessionStorage.getItem('deck'));
    goals = JSON.parse(window.sessionStorage.getItem('goals'));
    hand = JSON.parse(window.sessionStorage.getItem('hand'));

    return {board: board, deck: deck, goals: goals, hand: hand}
}

function drawCard() {
    state = getState();
    deck = state.deck;
    hand = state.hand;
    hand.push(deck.shift());
}

function createEmptyBoard() {
    board = [];
    for (let x = 0; x < 7; x++) {
        board[x] = [];
        for (let y = 0; y < 7; y++) {
            board[x][y] = {type: -1, coinstate: -1};
        }
    }
    return board;
}

function createShuffledDeck() {
    deck = [];
    for (let m = 0; m < 6; m++) {
        for (let n = 0; n < 6; n++) {
            deck.push(m);
        }
    }
    shuffleArray(deck);
    return deck;
}

function createGoals() {
    goalCards = []
    for (let m = 0; m < 6; m++) {
        for (let n = 0; n < 2; n++) {
            goalCards.push(m);
        }
    }
    shuffleArray(goalCards);

    firstGoal = {types:[goalCards[0], goalCards[1], goalCards[2]]};
    secondGoal = {types:[goalCards[3], goalCards[4], goalCards[5]]};
    thirdGoal = {types:[goalCards[6], goalCards[7], goalCards[8]]};
    fourthGoal = {types:[goalCards[9], goalCards[10], goalCards[11]]};

    return [firstGoal, secondGoal, thirdGoal, fourthGoal];
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

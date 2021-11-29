/*
Types of cells:
-1 : Empty cell
0-5: Resource -- [B]ranch [F]ruit [L]eaf [R]ock [S]hell [T]hread

Cards:
Each Card has an ID. ID of the card is n (0...5) + 6*type
E.g... the Leaf cards (type value 2) are IDs 12, 13, 14, 15, 16, 17

Coin States:

-1: empty
0: tentative coin
1: actual coin
*/

function newGameClick() {
    newGame();
    reload();
}

/*
Commands:
    place a card: ["c"] ["0" or "1" for which card in hand to place] [x coordinate] [y coordinate] ["h" or "v" for placing horizontal or vertical]
        e.g.: "c 1 4 3 h" -- Placing the second card in hand at coordinates 4 across 3 down, and placing horizontally.

*/
function inputCommandClick() {
    state = getState();
    hand = state.hand;

    command = document.getElementById('command').value
    args = command.split(' ')

    if (args[0] == 'c') {
        handIndex = args[1]
        y = parseInt(args[2])
        x = parseInt(args[3])
        horizontal = args[4].toLowerCase() == "h";

        cardId = hand[handIndex]

        result = placeCard(cardId, x, y, horizontal)
        console.log(result.status)
        console.log(result.message)
    }

    reload();
}

function reload() {
    gameState = getGameStateAscii();

    var container = document.getElementById("board");
    container.innerHTML = gameState.board;

    var container = document.getElementById("hand");
    container.innerHTML = gameState.hand;
}

function placeCard(cardId, x, y, horizontal) {
    state = getState();
    board = state.board;

    xdiff = horizontal ? 0 : 1;
    ydiff = horizontal ? 1 : 0;

    // First make sure its being placed fully on the board.
    if (x < 0 || x > 6 || y < 0 || y > 6 || (x+xdiff) > 6 || (y+ydiff > 6)) {
        return {status: "INVALID", message: "Trying to place a card off the board."}
    }

    // Lets make sure this is empty before we place it.
    if (board[x][y].id != -1 || board[x+xdiff][y+ydiff].id != -1) {
        return {status: "INVALID", message: "A card is already there!"}
    }

    // Ok, its empty. Lets place it as a tentative card and run the validation.
    board[x][y].id = cardId;
    board[x+xdiff][y+ydiff].id = cardId;
    board[x][y].tentative = true;
    board[x+xdiff][y+ydiff].tentative = true;
    board[x][y].coinstate = -1;
    board[x+xdiff][y+ydiff].coinstate = -1;

    // Also need to remove the card from hand!
    hand = state.hand;
    hand = hand.filter(c => c !== cardId); //removes card from hand matching cardId

    newstate = {board: board, deck: state.deck, goals: state.goals, hand: hand}
    saveState(newstate)

    validationResult = validateState()

    if (validationResult.status == "VALID") {
        board[x][y].tentative = false;
        board[x+xdiff][y+ydiff].tentative = false;

        confirmedstate = {board: board, deck: state.deck, goals: state.goals, hand: state.hand}
        saveState(confirmedstate)

        drawCard()
        return validationResult;
    }

    // Invalid placement, need to undo it. Lets put the card back in hand, then remove it from the board.
    hand.push(cardId);
    board[x][y].id = -1;
    board[x+xdiff][y+ydiff].id = -1;
    board[x][y].tentative = false;
    board[x+xdiff][y+ydiff].tentative = false;
    board[x][y].coinstate = -1;
    board[x+xdiff][y+ydiff].coinstate = -1;

    revertedstate = {board: board, deck: state.deck, goals: state.goals, hand: hand}
    saveState(revertedstate)
    return validationResult;
}

function validateState() {
    state = getState();
    board = state.board;
    deck = state.deck;
    hand = state.hand;

    //First checking cards on board. Counting tentative cells and real cells.
    numTentatives = 0;
    numReals = 0;
    tentativeCell1X = 0;
    tentativeCell1Y = 0;
    tentativeCell2X = 0;
    tentativeCell2Y = 0;

    for (let x = 0; x < 7; x++) {
        for (let y = 0; y < 7; y++) {
            if (board[x][y].id != -1 && !board[x][y].tentative) {
                numReals++;
            }

            if (board[x][y].tentative) {

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
    if (numReals + numTentatives + cellsInDeckAndHand != 72) {
        return {status: "INVALID", message: "Wrong number of cells. Did you try to place a card on top of another?"}
    }


    if (numTentatives == 2) {
        // We have a single tentative card. Make sure those are valid.
        // First lets make sure they're both of the same card.
        if (board[tentativeCell1X][tentativeCell1Y].id != board[tentativeCell2X][tentativeCell2Y].id) {
            return {status: "ERROR", message: "Tentative cells are different cards"}
        }

        // Next lets make sure they're next to each other.

        diffX = tentativeCell1X - tentativeCell2X;
        diffY = tentativeCell1Y - tentativeCell2Y;

        if (diffX * diffY != 0 || Math.abs(diffX + diffY) != 1) {
            return {status: "ERROR", message: "Tentative cells arent adjacent"}
        }

        // Verify that the card is next to another card (or is the first card placed), and is next to another card
        // of its type.

        placedType = cardType(board[tentativeCell1X][tentativeCell1Y].id);
        nextToCard = false;
        nextToCardOfSameType = false;
        for (let x = tentativeCell1X - 1; x < tentativeCell1X + 2; x++) {
            for (let y = tentativeCell1Y - 1; y < tentativeCell1Y + 2; y++) {
                if (x < 0) continue;
                if (y < 0) continue;
                if (x > 6) continue;
                if (y > 6) continue;
                if (x == y) continue;
                if (cardType(board[x][y].id) == placedType) {
                    nextToCardOfSameType = true;
                }
                if (board[x][y].id >= 0) {
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
                if (cardType(board[x][y].id) == placedType) {
                    nextToCardOfSameType = true;
                }
                if (board[x][y].id >= 0) {
                    nextToCard = true;
                }
            }
        }

        if (numReals > 0 && !nextToCard) {
            return {status: "INVALID", message: "Card must be placed next to an existing card."}
        }

        // TODO: If its NOT next to a card of the same time, make sure that there's no valid placement where we COULD
        // have done that.
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
                if (board[x][y].id == -1 || board[x][y].tentative) {
                    return {status: "ERROR", message: "Found a placed coin not on a card."}
                }
                numReals++;
            }

            if (board[x][y].coinstate == 0) {
                if (board[x][y].id == -1 || board[x][y].tentative) {
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


    // All looks good. Return valid status.
    return {status: "VALID", message: "valid"}
}

function getGameStateAscii() {
    state = getState();

    boardAscii = ""
    board = state.board;

    for (let x = 0; x < 7; x++) {
        for (let y = 0; y < 7; y++) {
            if (board[x][y].id == -1) {
                boardAscii += ".";
            } else {
                type = cardType(board[x][y].id)

                if (board[x][y].tentative) {
                    boardAscii += "bflrst".charAt(type)
                } else {
                    boardAscii += "BFLRST".charAt(type)
                }
            }
        }
        boardAscii += "<br>";
    }

    handAscii = ""
    hand = state.hand;
    for (const cardId of hand) {
        handAscii += "BFLRST".charAt(cardType(cardId)) + " "
    }

    return {'board':boardAscii, 'hand':handAscii};
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

    newstate = {board: state.board, deck: deck, goals: state.goals, hand: hand}
    saveState(newstate)
}

function cardType(cardId) {
    return cardId / 6;
}

function createEmptyBoard() {
    board = [];
    for (let x = 0; x < 7; x++) {
        board[x] = [];
        for (let y = 0; y < 7; y++) {
            board[x][y] = {id: -1, tentative: false, coinstate: -1};
        }
    }
    return board;
}

function createShuffledDeck() {
    deck = [];
    for (let m = 0; m < 6; m++) {
        for (let n = 0; n < 6; n++) {
            deck.push(m*6 + n);
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
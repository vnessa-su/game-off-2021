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

const BOARD_W = 8;
const BOARD_H = 8;

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
    let state = getState();
    let hand = state.hand;

    let command = document.getElementById('command').value
    let args = command.split(' ')

    if (args[0] == 'c') {
        let handIndex = args[1]
        let y = parseInt(args[2])
        let x = parseInt(args[3])
        let horizontal = args[4].toLowerCase() == "h";

        let cardId = hand[handIndex]

        let result = placeCard(cardId, x, y, horizontal)
        console.log(result.status)
        console.log(result.message)
    }

    reload();
}

function reload() {
    gameState = getGameStateAscii();

    let boardContainer = document.getElementById("board");
    boardContainer.innerHTML = gameState.board;

    let handContainer = document.getElementById("hand");
    handContainer.innerHTML = gameState.hand;

    let goalsContainer = document.getElementById("goals");
    goalsContainer.innerHTML = gameState.goals;

    let deckContainer = document.getElementById("deck");
    deckContainer.innerHTML = gameState.deck;
}

function checkEndOfGame() {
    let state = getState();
    let hand = state.hand;
    let deck = state.deck;

    if (deck.length > 0 || hand.length > 0) {
        return -1;
    }

    let coinsPlaced = 0;

    for (let x = 0; x < BOARD_W; x++) {
        for (let y = 0; y < BOARD_H; y++) {
            if (board[x][y].coinstate == 1) {
                coinsPlaced++;
            }
        }
    }
    score = coinsPlaced / 6;
    return score;
}

function placeTentativeCoin(x, y) {
    let state = getState();
    let board = state.board;
    if (board[x][y].coinstate != -1) {
        return {status: "INVALID", message: "There's already a coin there."};
    }
    board[x][y].coinstate = 0;

    let newstate = {board: board, deck: state.deck, goals: state.goals, hand: state.hand}
    saveState(newstate);
}

function submitTentativeCoins() {
    let result = validateState();
    let state = getState();
    let board = state.board;

    if (validationResult.status == "VALID") {
        // Find all 6 tentative coins and make them permanent.
        for (let x = 0; x < BOARD_W; x++) {
            for (let y = 0; y < BOARD_H; y++) {
                if (board[x][y].coinstate == 0) {
                    board[x][y].coinstate = 1;
                }
            }
        }
    }

    let newstate = {board: board, deck: state.deck, goals: state.goals, hand: state.hand}
    saveState(newstate);
}

function placeCard(cardId, x, y, horizontal) {
    let state = getState();
    let board = state.board;

    let xdiff = horizontal ? 0 : 1;
    let ydiff = horizontal ? 1 : 0;

    // First make sure its being placed fully on the board.
    if (x < 0 || x >= BOARD_W || y < 0 || y >= BOARD_H || (x+xdiff) >= BOARD_W || (y+ydiff >= BOARD_H)) {
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
    let hand = state.hand;
    hand = hand.filter(c => c !== cardId); //removes card from hand matching cardId

    let newstate = {board: board, deck: state.deck, goals: state.goals, hand: hand}
    saveState(newstate);

    let validationResult = validateState()

    if (validationResult.status == "VALID") {
        board[x][y].tentative = false;
        board[x+xdiff][y+ydiff].tentative = false;

        let confirmedstate = {board: board, deck: state.deck, goals: state.goals, hand: hand};
        saveState(confirmedstate);

        drawCard();
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

    let revertedstate = {board: board, deck: state.deck, goals: state.goals, hand: hand};
    saveState(revertedstate);
    return validationResult;
}

function validateState() {
    let state = getState();
    let board = state.board;
    let deck = state.deck;
    let hand = state.hand;
    let goals = state.goals;

    //First checking cards on board. Counting tentative cells and real cells.
    let numTentatives = 0;
    let numReals = 0;
    let tentativeCell1X = 0;
    let tentativeCell1Y = 0;
    let tentativeCell2X = 0;
    let tentativeCell2Y = 0;

    for (let x = 0; x < BOARD_W; x++) {
        for (let y = 0; y < BOARD_H; y++) {
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

        let diffX = tentativeCell1X - tentativeCell2X;
        let diffY = tentativeCell1Y - tentativeCell2Y;

        if (diffX * diffY != 0 || Math.abs(diffX + diffY) != 1) {
            return {status: "ERROR", message: "Tentative cells arent adjacent"}
        }

        // Verify that the card is next to another card (or is the first card placed), and is next to another card
        // of its type.

        let placedType = cardType(board[tentativeCell1X][tentativeCell1Y].id);
        let nextToCard = false;
        let nextToCardOfSameType = false;
        for (let checkDirectionX = -1; checkDirectionX < 2; checkDirectionX++) {
            for (let checkDirectionY = -1; checkDirectionY < 2; checkDirectionY++) {
                let checkX = tentativeCell1X + checkDirectionX;
                let checkY = tentativeCell1Y + checkDirectionY;
                if (!isValidCell(checkX, checkY)) continue;
                if (checkX == tentativeCell2X && checkY == tentativeCell2Y) continue; //Dont check the other cell of the same card.
                if (Math.abs(checkDirectionX) == Math.abs(checkDirectionY)) continue; //Only allows orthagonal adjacency.
                if (cardType(board[checkX][checkY].id) == placedType) {
                    nextToCardOfSameType = true;
                }
                if (board[checkX][checkY].id >= 0) {
                    nextToCard = true;
                }
            }
        }

        for (let checkDirectionX = -1; checkDirectionX < 2; checkDirectionX++) {
            for (let checkDirectionY = -1; checkDirectionY < 2; checkDirectionY++) {
                let checkX = tentativeCell2X + checkDirectionX;
                let checkY = tentativeCell2Y + checkDirectionY;
                if (!isValidCell(checkX, checkY)) continue;
                if (checkX == tentativeCell1X && checkY == tentativeCell1Y) continue; //Dont check the other cell of the same card.
                if (Math.abs(checkDirectionX) == Math.abs(checkDirectionY)) continue; //Only allows orthagonal adjacency.
                if (cardType(board[checkX][checkY].id) == placedType) {
                    nextToCardOfSameType = true;
                }
                if (board[checkX][checkY].id >= 0) {
                    nextToCard = true;
                }
            }
        }

        if (numReals > 0 && !nextToCard) {
            return {status: "INVALID", message: "Card must be placed next to an existing card."}
        }
        if (!nextToCardOfSameType) {
            for (let centerX = 0; centerX < BOARD_W; centerX++) {
                for (let centerY = 0; centerY < BOARD_H; centerY++) {
                    let centerType = cardType(board[centerX][centerY].id)
                    let isTentativeCell = board[centerX][centerY].tentative
                    if (centerType == placedType && !isTentativeCell) {
                        // If the checked cell is an existing cell of the same type, see if we could place next to it.
                        for (let checkDirectionX = -1; checkDirectionX < 2; checkDirectionX++) {
                            for (let checkDirectionY = -1; checkDirectionY < 2; checkDirectionY++) {
                                let checkX = centerX + checkDirectionX;
                                let checkY = centerY + checkDirectionY;

                                if (!isValidCell(checkX, checkY)) continue;
                                if (Math.abs(checkDirectionX) == Math.abs(checkDirectionY)) continue; //Only allows orthagonal adjacency.
                                
                                // Now, check both the orthagonally adjacent cell, and the cell one further.
                                // Both must be valid locations and empty for it to be a valid placement.
                                if (board[checkX][checkY].id != -1) continue;
                                let furtherCellX = checkX + checkDirectionX;
                                let furtherCellY = checkY + checkDirectionY;
                                if (!isValidCell(furtherCellX, furtherCellY)) continue;
                                if (board[furtherCellX][furtherCellY].id != -1) continue;

                                // At this point... we found at least one possible placement next to a same type cell.
                                return {status: "INVALID", message: "Need to place next to a cell of the same type."};
                            }
                        }
                    }
                }
            }
        }
    }

    // Card placement looks good.
    // Next lets verify coin placement, similar logic.
    let numTentativeCoins = 0;
    let numRealCoins = 0;
    let tentativeCells = []; //keys: 'x', 'y'

    // Getting counts of all coins and tentative coins. Also verifying all coins are on actual cards.
    for (let x = 0; x < BOARD_W; x++) {
        for (let y = 0; y < BOARD_H; y++) {
            if (board[x][y].coinstate == 1) {
                if (board[x][y].id == -1 || board[x][y].tentative) {
                    return {status: "ERROR", message: "Found a placed coin not on a card."}
                }
                numRealCoins++;
            }

            if (board[x][y].coinstate == 0) {
                if (board[x][y].id == -1 || board[x][y].tentative) {
                    return {status: "INVALID", message: "Found a tentative coin not on a card."}
                }
                numTentativeCoins++;
                tentativeCells.push({x: x, y: y});
            }
        }
    }

    // Every time we place coins, we place 6 at a time (covering 3 cards).
    if (numRealCoins % 6 != 0) {
        return {status: "ERROR", message: "Wrong number of real coins placed."}
    }

    // If there's no tentative coins, then we can return now, as card placement and real coin placement is already verified.
    if (numTentativeCoins == 0) {
        return {status: "VALID", message: "valid"}
    }

    // Make sure there are exactly 6 tentative coins placed.
    if (numTentativeCoins != 6) {
        return {status: "INVALID", message: "Placed the wrong number of coins."}
    }

    // Need to check if all tentative coins are adjacent.
    for (let tentativeCellIndex = 0; tentativeCellIndex < 6; tentativeCellIndex++) {
        let tentativeCell = tentativeCells[tentativeCellIndex];
        for (let checkDirectionX = -1; checkDirectionX < 2; checkDirectionX++) {
            for (let checkDirectionY = -1; checkDirectionY < 2; checkDirectionY++) {
                let checkX = tentativeCell.x + checkDirectionX;
                let checkY = tentativeCell.y + checkDirectionY;
                if (!isValidCell(checkX, checkY)) continue;
                if (Math.abs(checkDirectionX) == Math.abs(checkDirectionY)) continue; //Only allows orthagonal adjacency.

                let foundAdjacentCoin = false;
                for (let possibleAdjacentTentativeCellIndex = 0; possibleAdjacentTentativeCellIndex < 6; possibleAdjacentTentativeCellIndex++) {
                    let possibleAdjacentTentativeCell = tentativeCells[possibleAdjacentTentativeCellIndex];
                    if (tentativeCell.x == possibleAdjacentTentativeCell.x && tentativeCell.y == possibleAdjacentTentativeCell.y) continue;
                    if (checkX == possibleAdjacentTentativeCell.x && checkY == possibleAdjacentTentativeCell.y) {
                        foundAdjacentCoin = true;
                    }
                }
                if (!foundAdjacentCoin) {
                    return {status: "INVALID", message: "All coins must be on adjacent cards."};
                }
            }
        }
    }

    // Verify coins are on 3 different cards.
    let cardsWithCoins = []
    for (const tentativeCoin of tentativeCells) {
        cardsWithCoins.push(board[tentativeCoin.x][tentativeCoin.y].id);
    }
    let uniqueCardsWithCoins = [...new Set(cardsWithCoins)]; //removes duplicates
    if (uniqueCardsWithCoins.length != 3) {
        return {status: "INVALID", message: "Coins must be on exactly 3 cards"};
    }

    // Lastly, verify that the coins are fulfilling a single goal.
    let coinedTypes = [cardType(cardsWithCoins[0], cardType(cardsWithCoins[1], cardType(cardsWithCoins[2])))];
    coinedTypes.sort();
    let foundMatchingGoal = false;
    for (const goal of goals) {
        let goalTypes = goal.types;
        goalTypes.sort();
        if (coinedTypes == goalTypes) {
            foundMatchingGoal = true;
            break;
        }
    }

    if (!foundMatchingGoal) {
        return {status: "INVALID", message: "Must place coins on cards that match a goal."};
    }


    // All looks good. Return valid status.
    return {status: "VALID", message: "valid"}
}

function isValidCell(x, y) {
    return x >= 0 && x < BOARD_W && y >= 0 && y < BOARD_H;
}

function eqSet(as, bs) {
    if (as.size !== bs.size) return false;
    for (const a of as) if (!bs.has(a)) return false;
    return true;
}

function getGameStateAscii() {
    let state = getState();

    let boardAscii = ""
    let board = state.board;

    for (let x = 0; x < BOARD_W; x++) {
        for (let y = 0; y < BOARD_H; y++) {
            if (board[x][y].id == -1) {
                boardAscii += ".";
            } else {
                let type = cardType(board[x][y].id);

                if (board[x][y].tentative) {
                    boardAscii += "bflrst".charAt(type);
                } else {
                    boardAscii += "BFLRST".charAt(type);
                }
            }
        }
        boardAscii += "<br>";
    }

    let handAscii = "";
    let hand = state.hand;
    for (const cardId of hand) {
        handAscii += "BFLRST".charAt(cardType(cardId)) + " ";
    }

    let goalsAscii = "";
    let goals = state.goals;
    for (let goalIndex = 0; goalIndex < 4; goalIndex++) {
        let goal = goals[goalIndex];
        goalsAscii += "Goal " + goalIndex + ": ";
        for (let i = 0; i < 3; i++) {
            goalsAscii += "BFLRST".charAt(goal.types[i]);
        }
        goalsAscii += "<br>";
    }

    let deckAscii = ""
    let deck = state.deck;
    deckAscii = "Cards Remaining: " + deck.length;

    return {'board':boardAscii, 'hand':handAscii, 'goals':goalsAscii, 'deck':deckAscii};
}

function newGame() {
    let board = createEmptyBoard();
    let deck = createShuffledDeck();
    let goals = createGoals();
    let hand = [];

    let state = {board: board, deck: deck, goals: goals, hand: hand};
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
    let board = JSON.parse(window.sessionStorage.getItem('board'));
    let deck = JSON.parse(window.sessionStorage.getItem('deck'));
    let goals = JSON.parse(window.sessionStorage.getItem('goals'));
    let hand = JSON.parse(window.sessionStorage.getItem('hand'));

    return {board: board, deck: deck, goals: goals, hand: hand};
}

function drawCard() {
    let state = getState();
    let deck = state.deck;
    let hand = state.hand;

    if (deck.length == 0) {
        return false;
    }

    hand.push(deck.shift());

    let newstate = {board: state.board, deck: deck, goals: state.goals, hand: hand};
    saveState(newstate);
    return true;
}

function cardType(cardId) {
    return Math.floor(cardId / 6);
}

function createEmptyBoard() {
    let board = [];
    for (let x = 0; x < BOARD_W; x++) {
        board[x] = [];
        for (let y = 0; y < BOARD_H; y++) {
            board[x][y] = {id: -1, tentative: false, coinstate: -1};
        }
    }
    return board;
}

function createShuffledDeck() {
    let deck = [];
    for (let m = 0; m < 6; m++) {
        for (let n = 0; n < 6; n++) {
            deck.push(m*6 + n);
        }
    }
    shuffleArray(deck);
    return deck;
}

function createGoals() {
    let goalCards = []
    for (let m = 0; m < 6; m++) {
        for (let n = 0; n < 2; n++) {
            goalCards.push(m);
        }
    }
    shuffleArray(goalCards);

    let firstGoal = {types:[goalCards[0], goalCards[1], goalCards[2]]};
    let secondGoal = {types:[goalCards[3], goalCards[4], goalCards[5]]};
    let thirdGoal = {types:[goalCards[6], goalCards[7], goalCards[8]]};
    let fourthGoal = {types:[goalCards[9], goalCards[10], goalCards[11]]};

    return [firstGoal, secondGoal, thirdGoal, fourthGoal];
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}
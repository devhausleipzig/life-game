

///////////////////////////////
//// Initialize Game State ////
///////////////////////////////

const root = document.documentElement;
const gameGrid = document.querySelector('.game-grid')
const messages = document.querySelector('#messages')

const defaultDelay = 100; // ms
let delay = defaultDelay;

const defaultState = ['xy4_3', 'xy4_5', 'xy4_7', 'xy4_4','xy8_3', 'xy5_5', 'xy5_7', 'xy6_4', 'xy6_6', 'xy7_5', 'xy7_6', 'xy8_6', 'xy8_8'];

let liveCells = {};
let frozen = false;

messages.innerHTML = "<h4>Click start to evolve the universe</h3>"


const adjacencySelect = document.querySelector('#options-adjacency > select')
const adjacencyLinearBlock = document.querySelector('#linear-adjacency')
const adjacencyNonLinearBlock = document.querySelector('#non-linear-adjacency')

if(adjacencySelect.value == "linear"){
    adjacencyNonLinearBlock.classList.toggle('hide')
} else {
    adjacencyLinearBlock.classList.toggle('hide')
}

adjacencySelect.addEventListener('input', (event) => {
    adjacencyNonLinearBlock.classList.toggle('hide')
    adjacencyLinearBlock.classList.toggle('hide')
})


const optionsGridSize = document.querySelector("#options-grid-size > input")
optionsGridSize.addEventListener('input', (event) => {
        optionsGridSize.value = Math.max(11, Math.min(101, optionsGridSize.value));
})

const optionsHoodRadius = document.querySelector("#options-hood-radius > input")
optionsHoodRadius.addEventListener('input', (event) => {
    optionsHoodRadius.value = Math.max(1, Math.min(20, optionsHoodRadius.value));
})

function generateGridCells() {
    gameGrid.style.gridTemplateRows = `repeat(${optionsGridSize.value}, 1fr)`
    gameGrid.style.gridTemplateColumns = `repeat(${optionsGridSize.value}, 1fr)`

    for (let i = 0; i < optionsGridSize.value; i++) {
        for (let j = 0; j < optionsGridSize.value; j++) {
            const gridSquare = document.createElement('div');
            gridSquare.id = `xy${i}_${j}`
            gridSquare.classList.add('grid-square')
            gridSquare.style.width = `${600/optionsGridSize.value}px`
            gridSquare.style.height = `${600/optionsGridSize.value}px`
            gridSquare.style.border = `${2/(8* (optionsGridSize.value - 3) + 1)}px solid #D3219B`
            
            gameGrid.appendChild(gridSquare)
        }
    }
}

generateGridCells()

// create default live cells
defaultState.forEach( (id) => {
    liveCells[id] = {
        'id': id
    }
    const square = document.querySelector(`#${id}`);
    styleSquare(square, 'live-cell')
})


///////////////////////////
//// State Transitions ////
///////////////////////////

function filterInvalid(coordinate) {
    if(coordinate.length !== 2){
        throw Error(`Check yo self: ${coordinate}`)
    }
    const [row, column] = coordinate;
    return  (row < 0 || row > optionsGridSize.value-1 || column < 0 || column > optionsGridSize.value-1)
}

function horAdj([row, column]){   
    const left = [row, column - 1];
    const right = [row, column + 1];
    const adjacents = [left, right]
    return adjacents
}

function vertAdj([row, column]){   
    const above = [row - 1, column];
    const below = [row + 1, column];
    const adjacents = [above, below]
    return adjacents
}

function backDiaAdj([row, column]){   
    const topleft = [row - 1, column - 1];
    const bottomright = [row + 1, column + 1];
    const adjacents = [topleft, bottomright]
    return adjacents
}

function forDiaAdj([row, column]){  
    const topright = [row - 1, column + 1];
    const bottomleft = [row + 1, column - 1];
    const adjacents = [topright, bottomleft]
    return adjacents
}

const adjFuncMap = {
    "option-adjacency-hor": horAdj,
    "option-adjacency-vert": vertAdj,
    "option-adjacency-backdia": backDiaAdj,
    "option-adjacency-fordia": forDiaAdj
}

const adjModeElementMap = {
    "linear": adjacencyLinearBlock,
    "non-linear": adjacencyNonLinearBlock
}

function computeActiveAdjFuncs(){
    const activeAdjFuncs = [];
    const adjFuncBools = adjModeElementMap[adjacencySelect.value].querySelectorAll('div')

    for(const adjFuncBool of adjFuncBools){
        if(adjFuncBool.querySelector('input').checked){
            activeAdjFuncs.push( adjFuncMap[adjFuncBool.id] )
        }
    }
    return activeAdjFuncs;
}

// function recursiveCheck(player, coordinate, adjacencyFunction, winLength, currentLength = 1, memo = null){

//     if( currentLength == winLength ) {
//         return true;
//     }

//     if(memo == null){
//         memo = new Set()
//     }

//     let winFlag = false;

//     let [row, column] = coordinate;
//     let id = `xy_${row}-${column}`
//     memo.add(id)

//     const adjacents = adjacencyFunction(coordinate).filter( 
//         (adjacent) => {
//             let [row, column] = adjacent;
//             let id = `xy_${row}-${column}`
//             return !(memo.has(id)) //keep if adjacent is not in memo
//         }
//     )

//     for(const adjacent of adjacents){
//         if(winFlag){
//             return winFlag; // shortcircuit looping through adjacents if win already found
//         }

//         let [row, column] = adjacent;
//         let id = `xy_${row}-${column}`

//         if ( checkIfMarked(id) ){
//             memo.add(id)
//             if (whichPlayer(id) == player){
//                 winFlag = winFlag || recursiveCheck(player, adjacent, adjacencyFunction, winLength, currentLength + 1, memo);
//             }
//         }
//     }

//     return winFlag;
// }



 // if cell is alive, 2 or 3 neighbors survives
// less or more, dies
// if cell is alive, needs exactly 3 neighbors to resurrect

function checkUpdateRules(id, isAlive, count){
    if(isAlive){
        if(count <2 || count>3){
            return {
                'id': id,
                'action': 'kill'
            }
        }
    } else {
        if(count == 3){
            return  {
                'id': id,
                'action': 'resurrect'
            }
        }
    }
}


function computeUpdates(coordinate, hoodRadius, cellUpdateMemo, stop = false){
    const id = `xy${coordinate[0]}_${coordinate[1]}`

    const activeAdjFuncs = computeActiveAdjFuncs();

    const compositeAdjacencyFunction = function(coordinate) {
        const adjacents = [];

        for(const adjFunc of activeAdjFuncs){
            adjacents.push(adjFunc(coordinate))
        }
        return adjacents.flat()
    }

    const neighborhood = compositeAdjacencyFunction(coordinate);

    let cellUpdates = []

    if(stop){
        if(cellUpdateMemo[id]){
            return []
        } else {
            cellUpdateMemo[id] = true;
        }

        let aliveCellsCounter = 0;

        for(const neighbor of neighborhood){
            const id = `xy${neighbor[0]}_${neighbor[1]}`
            if(liveCells[id]){
                aliveCellsCounter++
            }
        }

        const isAlive = liveCells[id] ? true: false
        const update = checkUpdateRules(id, isAlive, aliveCellsCounter);

        if(update){
            return update
        }
    } else {
        neighborhood.push(coordinate)
        for(const cell of neighborhood){
            cellUpdates.push(
                computeUpdates(cell, optionsHoodRadius.value, cellUpdateMemo, true)
            )
        }
    }
    return cellUpdates.flat()
}

gameGrid.addEventListener("click", (event) => {
    if( event.target.matches('.game-grid > .grid-square') && !frozen ) {
        event.target.classList.toggle('live-cell');
        liveCells[event.target.id] = {
            'id': event.target.id
        }
    }
})


///////////////////
//// Game Loop ////
///////////////////

let done = false

function gameLoop(){
    if(!done){
        updateGameState();
        setTimeout( () => {
            window.requestAnimationFrame(gameLoop)
        }, delay);
    }
}

function updateGameState(){
    const cellUpdateMemo = {}
    let cellUpdates = []

    for(const liveCell in liveCells ){
        const coordinate = liveCell.replace('xy', '').split('_').map( (elem) => Number(elem) )
        cellUpdates.push(
            computeUpdates(coordinate, optionsHoodRadius.value, cellUpdateMemo)
        )

    }

    cellUpdates = cellUpdates.flat()

    for(const cellUpdate of cellUpdates){
        const id = cellUpdate.id
        const coordinate = id.replace('xy', '').split('_').map( (elem) => Number(elem) )

        switch(cellUpdate.action){
            
            case 'resurrect':
                liveCells[id] = {
                    'id': id,
                };
                if(!filterInvalid(coordinate)){
                    const deadCell = document.querySelector(`#${id}`)
                    styleSquare(deadCell, 'live-cell')
                }
                break
            case 'kill':
                delete liveCells[id]
                if(!filterInvalid(coordinate)){
                    const liveCell = document.querySelector(`#${id}`)
                    styleSquare(liveCell, 'live-cell')
                }
                break
        }
    }
}

const startButton = document.querySelector('#button-start');

startButton.addEventListener('click', () => {
    done = false;
    frozen = true;
    gameLoop();
})

const resetButton = document.querySelector('#button-reset');

resetButton.addEventListener('click', () => {
    done = true;
    frozen = false;
    removeChildren(gameGrid);
    generateGridCells();
    
    // create default live cells
    defaultState.forEach( (id) => {
        liveCells[id] = {
            'id': id
        }
        const square = document.querySelector(`#${id}`);
        styleSquare(square, 'live-cell')
    })

    messages.innerHTML = "<h4>How does it feel to be God?</h4>";
})

function removeChildren(element) {
    while (element.lastElementChild) {
        element.removeChild(element.lastElementChild);
    }
}
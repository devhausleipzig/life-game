

///////////////////////////////
//// Initialize Game State ////
///////////////////////////////

const root = document.documentElement;
const gameGrid = document.querySelector('.game-grid')
const messages = document.querySelector('#messages')

const defaultDelay = 300; // ms
let delay = defaultDelay;

const defaultState = ['xy_5-3', 'xy_5-5', 'xy_5-7', 'xy_6-4', 'xy_6-6', 'xy_7-5'];

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
            gridSquare.id = `xy_${i}-${j}`
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

// function filterInvalid(array) {
//     return array.filter(
//         (coordinate) => {
//             const [row, column] = coordinate;
//             return  !(row < 0 || row > optionsGridSize.value || column < 0 || column > optionsGridSize.value)
//         }
//     )
// }

function filterInvalid(array){
    return array;
}

function horAdj([row, column]){   
    const left = [row, column - 1];
    const right = [row, column + 1];
    const adjacents = [left, right]
    return filterInvalid(adjacents)
}

function vertAdj([row, column]){   
    const above = [row - 1, column];
    const below = [row + 1, column];
    const adjacents = [above, below]
    return filterInvalid(adjacents)
}

function backDiaAdj([row, column]){   
    const topleft = [row - 1, column - 1];
    const bottomright = [row + 1, column + 1];
    const adjacents = [topleft, bottomright]
    return filterInvalid(adjacents)
}

function forDiaAdj([row, column]){  
    const topright = [row - 1, column + 1];
    const bottomleft = [row + 1, column - 1];
    const adjacents = [topright, bottomleft]
    return filterInvalid(adjacents)
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
    const id = `xy_${coordinate[0]}-${coordinate[1]}`

    if(cellUpdateMemo[id]){
        return []
    } else {
        cellUpdateMemo[id] = true;
    }

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
        let aliveCellsCounter = 0;
        for(const neighbor of neighborhood){
            const id = `xy_${neighbor[0]}-${neighbor[1]}`
            if(liveCells[id]){
                aliveCellsCounter++
            }
        }
        const id = `xy_${coordinate[0]}-${coordinate[1]}`
        const isAlive = liveCells[id] ? true: false
        const update = checkUpdateRules(id, isAlive, aliveCellsCounter);
        if(update){
            return update
        }
    } else {
        neighborhood.push(coordinate)
        for(const cell of neighborhood){
            cellUpdates.push(
                computeUpdates(cell, optionsHoodRadius.value, cellUpdateMemo, stop = true)
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

let count = 0;

function gameLoop(){
    if(!done){
        updateGameState();
        count++
        if(count == 1){
            return;
        }
        setTimeout( () => {
            window.requestAnimationFrame(gameLoop)
        }, delay);
    }
}

function updateGameState(){
    const cellUpdateMemo = {}
    let cellUpdates = []

    for(const liveCell in liveCells ){
        const coordinate = liveCell.replace('xy_', '').split('-').map( (elem) => Number(elem) )
        cellUpdates.push(
            computeUpdates(coordinate, optionsHoodRadius.value, cellUpdateMemo)
        )

    }

    cellUpdates = cellUpdates.flat()

    console.log('cellUpdates!!!: ', cellUpdates)

    for(const cellUpdate of cellUpdates){
        console.log(cellUpdate)
        const id = cellUpdate.id

        switch(cellUpdate.action){
            case 'resurrect':
                liveCells[id] = {
                    'id': id,
                };
                const deadCell = document.querySelector(`#${id}`)
                styleSquare(deadCell, 'live-cell')
                break
            case 'kill':
                delete liveCells[id]
                const liveCell = document.querySelector(`#${id}`)
                styleSquare(liveCell, 'live-cell')
                break
        }
    }

    console.log(liveCells)
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
    removeLiveStyling(gameGrid.children);
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

function removeLiveStyling(collection) {
    for (const element of collection) {
        styleSquare(element, 'live-cell')
    }
}

function removeChildren(element) {
    while (element.lastElementChild) {
        element.removeChild(element.lastElementChild);
    }
}
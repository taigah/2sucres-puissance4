const EventEmitter = require('events')
const { assert } = require('chai')

class Game extends EventEmitter {
  constructor ({ player1Name, player2Name, verbose, randomBlocks }) {
    super()
    player1Name = player1Name || 'Player 1'
    player2Name = player2Name || 'Player 2'
    randomBlocks = randomBlocks || 0
    verbose = verbose instanceof Boolean ? verbose : false
    assert.isString(player1Name)
    assert.isString(player2Name)
    assert.isNumber(randomBlocks)
    assert.isBoolean(verbose)
    this.verbose = verbose
    this.cols = 7
    this.rows = 6
    this.currentPlayer = 1
    this.players = [{
      id: 1,
      name: player1Name
    }, {
      id: 2,
      name: player2Name
    }]
    this.state = {
      status: 'playing',
      winner: null,
      currentPlayer: this.players[0],
      grid: Array(this.cols).fill(null).map(v => Array(this.rows).fill(0))
    }
    for (let i = 0; i < randomBlocks; ++i) {
      const x = Math.floor(Math.random() * this.cols)
      const y = Math.floor(Math.random() * this.rows)
      this.state.grid[x][y] = 3
    }
  }

  play (col) {
    assert.isNumber(col)
    if (this.state.grid[col] === undefined || this.state.grid[col][0] !== 0) throw new Error('bad move')
    let j
    for (j = 0; j < this.rows + 1; ++j) {
      if (this.state.grid[col][j] !== 0) break
    }
    this.state.grid[col][j - 1] = this.state.currentPlayer.id
    this.log(this.state.currentPlayer.name, 'played', col)
    if (this.checkState()) return
    this.state.currentPlayer = this.state.currentPlayer.id === 1 ? this.players[1] : this.players[0]
  }

  checkState () {
    for (let i = 0; i < this.cols; ++i) {
      for (let j = 0; j < this.rows; ++j) {
        if (this.checkCell(i, j)) {
          this.state.status = 'finished'
          this.state.winner = this.state.currentPlayer
          this.log(this.state.winner.name, 'won!')
          this.emit('end', this.state.currentPlayer)
          return true
        }
      }
    }
    let emptyCells = 0
    for (let i = 0; i < this.cols; ++i) {
      if (this.state.grid[i][0] === 0) ++emptyCells
    }
    if (emptyCells === 0) {
      this.state.status = 'finished'
      this.log('draw')
      this.emit('end', null)
      return true
    }
    return false
  }

  checkLine (i, j, dirX, dirY) {
    const cellState = this.state.grid[i][j]
    for (let pos = 1; pos < 4; ++pos) {
      if (this.state.grid[i + pos * dirX] === undefined || this.state.grid[i + pos * dirX][j + pos * dirY] !== cellState) return false
    }
    return true
  }
  
  checkCell (i, j) {
    if (this.state.grid[i][j] === 0) return false
    const dirs = [
      // rows
      [0, -1],
      [0, 1],
      // cols
      [-1, 0],
      [1, 0],
      // diags
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1]
    ]
    for (let dir of dirs) {
      if (this.checkLine(i, j, ...dir)) return true
    }
    return false
  }

  display () {
    console.log(`current player: ${this.state.currentPlayer.name}`)
    for (let j = 0; j < this.rows; ++j) {
      const row = []
      for (let i = 0; i < this.cols; ++i) {
        row.push(this.state.grid[i][j])
      }
      console.log(row.join(' '))
    }
  }

  log (...args) {
    if (this.verbose === false) return
    console.log(...args)
  }
}

module.exports = Game
const EventEmitter = require('events')
const Game = require('./game')
const { assert } = require('chai')
const _ = require('lodash')

const TOKENS = [
  'https://image.noelshack.com/fichiers/2017/49/5/1512734306-pict-svg.png', // empty
  'https://image.noelshack.com/fichiers/2017/49/5/1512734403-pict-svg.png', // player 1
  'https://image.noelshack.com/fichiers/2017/49/5/1512734421-pict-svg.png', // player 2
  'https://image.noelshack.com/fichiers/2018/30/1/1532348939-qqamqo82.png' // obstacle
]

class Party extends EventEmitter {
  constructor (bot, topic) {
    super()
    assert.isObject(topic)
    this.game = null
    this.bot = bot
    this.topic = topic
    this.originalMessage = topic.messages[0]
    this.playerMessages = []
    this.updatedStatus = true
    this.turn = null
    this.status = 'waiting'
    this.lastPlay = Date.now()
  }

  static async create (bot) {
    // create topic
    const { id } = await bot.force(() => bot.createTopic('[BOT] Puissance 4', `En attente de deux joueurs\nPostez sur le topic pour participer`))
    return this.bind(bot, +id)
  }

  static async bind (bot, topicId) {
    assert.isNumber(topicId)
    const topic = await bot.force(() => bot.getMessages(topicId))
    // create party
    return new this(bot, topic)
  }

  changeStatus (status) {
    this.updatedStatus = true
    this.status = status
  }

  async run () {
    try {
      console.log('status:', this.status)
      await this.parseTopic()
      if (this.updatedStatus) {
        await this.updateTopic()
      }
      if (this.status === 'end') return
      setTimeout(() => this.run(), 2000)
    } catch (err) {
      console.error(err)
    }
  }

  getCurrentPlayerMessage () {
    const messageId = this.game.state.currentPlayer.id - 1
    return this.playerMessages[messageId]
  }

  async parseTopic() {
    if (this.status === 'waiting') {
      const rawMessages = (await this.bot.force(() => this.bot.getMessages(+this.topic.topic.id))).messages.splice(1)
      const messages = _.uniqBy(rawMessages, 'user')
      if (messages.length >= 2) {
        this.playerMessages = messages.slice(0, 2)
        this.game = new Game({
          player1Name: this.playerMessages[0].user_pseudo_custom,
          player2Name: this.playerMessages[1].user_pseudo_custom,
          randomBlocks: Math.random() < 0.2 ? 1 : 0 // 20% chance having a random block
        })
        this.game.on('end', winner => this.win(winner))
        this.lastPlay = Math.max(+this.playerMessages[0].edited, +this.playerMessages[0].tms, +this.playerMessages[1].edited, +this.playerMessages[1].tms)
        // todo: pin both messages
        await this.bot.force(() => this.bot.editTitle(+this.topic.topic.id, `[BOT] Puissance 4 - ${this.playerMessages[0].user_pseudo_custom} - ${this.playerMessages[1].user_pseudo_custom} : Match en cours`))
        this.changeStatus('playing')
      } else if (messages.length.length === 1) {
        this.playerMessages = [ messages[0] ]
        this.changeStatus('waiting')
      }
    } else if (this.status === 'playing') {
      if (Date.now() / 1000 - this.lastPlay >= 5 * 60) {
        return this.changeStatus('aborted')
      }
      const messageId = this.game.state.currentPlayer.id - 1
      this.playerMessages[messageId] = (await this.bot.force(() => this.bot.getMessage(+this.getCurrentPlayerMessage().id))).message
      const currentPlayerMessage = this.getCurrentPlayerMessage()
      if (+currentPlayerMessage.edited <= this.lastPlay) return
      if (!/[1-7]/.test(currentPlayerMessage.content)) return
      const move = +currentPlayerMessage.content.match(/[1-7]/)[0]
      try {
        this.game.play(move - 1)
        this.updatedStatus = true
      } catch (err) {
        if (err.message !== 'bad move') throw err
        else {
          console.log('bad move')
          this.game.display()
        }
      }
      this.lastPlay = +currentPlayerMessage.edited
    }
  }

  async updateTopic () {
    let message
    if (this.status === 'waiting') {
      message = this.playerMessages.length === 0 ? 'En attente de deux joueurs\n' : `En attente d'un joueur\n`
      message += 'Postez sur le topic pour participer'
    } else if (this.status === 'playing') {
      message = `Jeu en cours : ${this.playerMessages[0].user_pseudo_custom} - ${this.playerMessages[1].user_pseudo_custom}\n`
      message += `Tour : ${this.game.state.currentPlayer.name}\n`
      message += `Instructions :\n`
      message += `Pour placer un jeton dans une colonne, mettez le numéro (1-7) de la colonne au **TOUT DÉBUT** de votre message. C'est-à-dire avant les stickers, avant les smileys, avant le texte, avant tout. Au. Début.  https://image.noelshack.com/fichiers/2017/49/7/1512934084-4.png?risibank\n`
      message += this.getBoard()
    } else if (this.status === 'finished') {
      message = `Jeu terminé : ${this.playerMessages[0].user_pseudo_custom} - ${this.playerMessages[1].user_pseudo_custom}\n`
      if (this.game.state.winner === null) {
        message += `**Match nul**\n`
      } else {
        message += `Vainqueur : **${this.game.state.winner.name}**\n`
      }
      message += this.getBoard()
      this.changeStatus('end')
      this.emit('end')
      await this.bot.force(() => this.bot.editTitle(+this.topic.topic.id, `[BOT] Puissance 4 - ${this.playerMessages[0].user_pseudo_custom} - ${this.playerMessages[1].user_pseudo_custom} : Match terminé`))
    } else if (this.status === 'aborted') {
      message = `Jeu terminé : ${this.playerMessages[0].user_pseudo_custom} - ${this.playerMessages[1].user_pseudo_custom}\n`
      message += `Vainqueur : **${this.playerMessages[this.game.state.currentPlayer.id === 1 ? 1 : 0].user_pseudo_custom}** par forfait\n`
      message += this.getBoard()
      this.changeStatus('end')
      this.emit('end')
      await this.bot.force(() => this.bot.editTitle(+this.topic.topic.id, `[BOT] Puissance 4 - ${this.playerMessages[0].user_pseudo_custom} - ${this.playerMessages[1].user_pseudo_custom} : Match terminé`))
    }
    await this.bot.force(() => this.bot.editMessage(+this.originalMessage.id, message))
    this.updatedStatus = false
  }

  getBoard () {
    const rows = []
    for (let j = 0; j < this.game.rows; ++j) {
      const row = []
      for (let i = 0; i < this.game.cols; ++i) {
        const token = TOKENS[this.game.state.grid[i][j]]
        row.push(token)
      }
      rows.push(row.join(' '))
    }
    return rows.join('\n')
  }

  win (winner) {
    console.log('win', winner)
    this.changeStatus('finished')
  }
}

module.exports = Party
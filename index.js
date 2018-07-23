const { cookies, ajaxToken } = require('./config')
const Party = require('./party')

class Bot extends require('2sucres-api') {
  async run () {
    try {
      const party = await Party.create(this)
      party.on('end', () => {
        setTimeout(() => {
          this.run()
        }, 60000)
      })
      party.run()
    } catch (err) {
      console.error(err)
    }
  }
}

const bot = new Bot(cookies, ajaxToken)
bot.run().catch(console.error)
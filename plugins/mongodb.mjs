import fastifyPlugin from 'fastify-plugin'

import fastifyMongo from '@fastify/mongodb'

export default fastifyPlugin(async (fastify, opts) => {
  try {
    const DB_URI = process.env.DB_URI || 'mongodb://127.0.0.1:27017/web'

    await fastify.register(fastifyMongo, {
      forceClose: true,
      url: DB_URI
    })
  } catch(e) {
    console.log(e)
  }
})

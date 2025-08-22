import fastifyPlugin from 'fastify-plugin'

import fastifyMongo from '@fastify/mongodb'

export default fastifyPlugin(async function (fastify, opts) {
  const DB_URI = process.env.DB_URI || 'mongodb://127.0.0.1:27017/tgtm'

  await fastify.register(fastifyMongo, {
    forceClose: true,
    url: DB_URI
  })
})

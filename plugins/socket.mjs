import fastifyPlugin from 'fastify-plugin'

import { Server } from 'socket.io'

export default fastifyPlugin(function (fastify, opts, done) {
  let envOrigins = process.env.CLIENT_ORIGIN || process.env.CLIENT_ORIGINS || '*'

  const allowedOrigins = envOrigins === '*'
    ? '*'
    : envOrigins.split(',').map(origin => origin.trim())
console.log(allowedOrigins)
  fastify.io = new Server(fastify.server, {
    ...opts,
    cors: {
      methods: ['GET', 'POST'],
      origin: allowedOrigins,
    }
  })

  fastify.addHook('onClose', (fastify, next) => {
    fastify.io.close()
    next()
  })

  done()
})

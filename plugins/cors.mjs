import fastifyPlugin from 'fastify-plugin'

import Cors from '@fastify/cors'

export default fastifyPlugin(function (fastify, opts, done) {
  let envOrigins = process.env.ORIGIN || process.env.ORIGINS || '*'

  const allowedOrigins = envOrigins === '*'
    ? '*'
    : envOrigins.split(',').map(origin => origin.trim())

  fastify.register(Cors, {
    origin: (origin, cb) => {
      if (!origin || allowedOrigins === '*' || (Array.isArray(allowedOrigins) && allowedOrigins.includes(origin))) {
        cb(null, true)
      } else {
        cb(new Error("Not allowed by CORS"), false)
      }
    },
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true
  })

  fastify.addHook('onSend', (request, reply, payload, done) => {
    console.log('Origin:', request.headers.origin)
    console.log('Access-Control-Allow-Origin:', reply.getHeader('Access-Control-Allow-Origin'))
    done()
  })

  fastify.addHook('onRequest', (request, reply, done) => {
    console.log('Origin (onRequest):', request.headers.origin)
    done()
  })

  done()
})

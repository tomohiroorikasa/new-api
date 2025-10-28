import fastifyPlugin from 'fastify-plugin'

import Cors from '@fastify/cors'

export default fastifyPlugin(async (fastify, opts) => {
  let envOrigins = process.env.ORIGIN || process.env.ORIGINS || '*'

  const allowedOrigins = envOrigins === '*'
    ? '*'
    : envOrigins.split(',').map(origin => origin.trim())

  await fastify.register(Cors, {
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

  /*
  fastify.addHook('onSend', async (request, reply, payload) => {
    // console.log('Origin:', request.headers.origin)
    // console.log('Access-Control-Allow-Origin:', reply.getHeader('Access-Control-Allow-Origin'))
  })

  fastify.addHook('onRequest', async (request, reply) => {
    // console.log('Origin (onRequest):', request.headers.origin)
  })
  */
})

import fastifyPlugin from 'fastify-plugin'

import Sensible from '@fastify/sensible'

export default fastifyPlugin(async (fastify, opts) => {
  await fastify.register(Sensible, {
    errorHandler: false
  })
})

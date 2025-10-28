import fastifyPlugin from 'fastify-plugin'

import Caching from '@fastify/caching'

export default fastifyPlugin(async (fastify, opts) => {
  await fastify.register(Caching,{
    privacy: Caching.privacy.NOCACHE
  }, (err) => { if (err) throw err })
})

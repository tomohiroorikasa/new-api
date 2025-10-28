import fastifyPlugin from 'fastify-plugin'

import Helmet from '@fastify/helmet'

export default fastifyPlugin(async (fastify, opts) => {
  const policy = process.env.REFERRER_POLICY || 'same-origin'

  await fastify.register(Helmet, {
    referrerPolicy: {
      policy: policy
    }
  })
})

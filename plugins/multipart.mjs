import fastifyPlugin from 'fastify-plugin'

import Multipart from '@fastify/multipart'

export default fastifyPlugin(async (fastify, opts) => {
  await fastify.register(Multipart, {
    limits: {
      files: 4,
      fileSize: 512 * 1024 * 1024
    }
  })
})

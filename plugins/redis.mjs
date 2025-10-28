import fastifyPlugin from 'fastify-plugin'

import Redis from '@fastify/redis'

export default fastifyPlugin(async (fastify, opts) => {
  const url = new URL(process.env.VALKEY_URI)

  const service = url.protocol
  const host = url.hostname
  const port = Number(url.port)

  let options = {
    host: host,
    port: port
  }
  if (service === 'rediss:') {
    options.tls = {}
  }

  try {
    await fastify.register(Redis, options)
  } catch(e) {
    console.log(e)
  }
})

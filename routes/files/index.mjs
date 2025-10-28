import { CurrentUser } from '../../lib.mjs'

export default async function (fastify, opts) {
  fastify.get('/count', async (req, reply) => {
    try {
      const email = await fastify.auth0.checkSignIn(fastify, req.headers)
      if (!email) {
        // throw new Error('Invalid Token')
      }

      let currentUser
      if (email) {
        currentUser = await CurrentUser(fastify, email)
      }

      const count = await fastify.mongo.db
        .collection('Files')
        .countDocuments({
          deleted: { $ne: true }
        })

      reply.send(count)
    } catch (err) {
      console.error(err)
      reply.code(400).send(err)
    }
  })

  fastify.get('/', async (req, reply) => {
    try {
      const email = await fastify.auth0.checkSignIn(fastify, req.headers)
      if (!email) {
        // throw new Error('Invalid Token')
      }

      let currentUser
      if (email) {
        currentUser = await CurrentUser(fastify, email)
      }

      const sort = req.query.sort ? req.query.sort.split(',') : ['-createdAt']
      const limit = Number(req.query.limit || 100)
      const skip = Number(req.query.skip || 0)

      const sortObj = {}
      for (const s of sort) {
        if (s.startsWith('-')) sortObj[s.substring(1)] = -1
        else sortObj[s] = 1
      }

      const files = await fastify.mongo.db
        .collection('Files')
        .find({ deleted: { $ne: true } })
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .toArray()

      reply.send(files)
    } catch (err) {
      console.error(err)
      reply.code(400).send(err)
    }
  })
}

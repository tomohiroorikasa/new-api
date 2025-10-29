import { Clone, GetConfig, CurrentUser } from "../../../../../lib.mjs"

export default async function (fastify, opts) {
  fastify.post('/', async (req, reply) => {
    let ret = false

    try {
      const email = await fastify.auth0.checkSignIn(fastify, req.headers)
      if (!email) throw new Error('Invalid Token')

      const currentUser = await CurrentUser(fastify, email)
      if (!currentUser) throw new Error('Not Found User')

      // const config = await GetConfig(fastify)
      // if (!config.isOpen && !email) throw new Error('Need Login')

      const magazine = await fastify.mongo.db
        .collection('Magazines')
        .findOne({
          _id: new fastify.mongo.ObjectId(req.params.id),
          deleted: { $ne: true }
        })
      if (!magazine) {
        throw new Error('Not Found Magazine')
      }

      const file = await fastify.mongo.db
        .collection('Files')
        .findOne({
          _id: new fastify.mongo.ObjectId(req.params.fileId),
          // extension: fileExt
        })
      if (!file) {
        throw new Error('Not Found File')
      }

      const files = []
      for (const fileId of magazine.files || []) {
        if (String(fileId) === String(file._id)) {
          throw new Error('Already Exists FileId')
        }
        files.push(fileId)
      }

      files.push(file._id)

      await fastify.mongo.db.collection('Magazines').updateOne({
        _id: magazine._id
      }, {
        $set: {
          files: files,
          patchedBy: currentUser._id,
          patchedAt: new Date()
        }
      })

      ret = true

    } catch (err) {
      console.error(err)
      reply.code(400).send(err)
    }

    return ret
  })

  fastify.delete('/', async (req, reply) => {
    let ret = false

    try {
      const email = await fastify.auth0.checkSignIn(fastify, req.headers)
      if (!email) throw new Error('Invalid Token')

      const currentUser = await CurrentUser(fastify, email)
      if (!currentUser) throw new Error('Not Found User')

      // const config = await GetConfig(fastify)
      // if (!config.isOpen && !email) throw new Error('Need Login')

      const magazine = await fastify.mongo.db
        .collection('Magazines')
        .findOne({
          _id: new fastify.mongo.ObjectId(req.params.id),
          deleted: { $ne: true }
        })
      if (!magazine) {
        throw new Error('Not Found Magazine')
      }

      const file = await fastify.mongo.db
        .collection('Files')
        .findOne({
          _id: new fastify.mongo.ObjectId(req.params.fileId),
          // extension: fileExt
        })
      if (!file) {
        throw new Error('Not Found File')
      }

      const files = []
      for (const fileId of magazine.files || []) {
        files.push(String(fileId))
      }

      if (!files.includes(String(file._id))) {
        throw new Error('Not Found FileId')
      }

      const updatedFiles = []
      for (const fileId of magazine.files || []) {
        if (String(fileId) !== String(file._id)) {
          updatedFiles.push(fileId)
        }
      }

      await fastify.mongo.db.collection('Magazines').updateOne({
        _id: magazine._id
      }, {
        $set: {
          files: updatedFiles,
          patchedBy: currentUser._id,
          patchedAt: new Date()
        }
      })

      ret = true

    } catch (err) {
      console.error(err)
      reply.code(400).send(err)
    }

    return ret
  })
}

import { Clone, GetConfig, CurrentUser, LoadFile } from "../../../../../lib.mjs"

export default async function (fastify, opts) {
  fastify.get('/', async (req, reply) => {
    let _id = null

    try {
      const email = await fastify.auth0.checkSignIn(fastify, req.headers)
      if (!email) {
        // throw new Error('Invalid Token')
      }

      const config = await GetConfig(fastify)
      if (!config.isOpen && !email) {
        throw new Error('Need Login')
      }

      let currentUser
      if (email) {
        currentUser = await CurrentUser(fastify, email)
      }

      let post = await fastify.mongo.db
        .collection('Posts')
        .findOne({
          _id: new fastify.mongo.ObjectId(req.params.id),
          // deleted: { $ne: true }
        })
      if (!post) {
        throw new Error('Not Found Post')
      }

      const file = await fastify.mongo.db
        .collection('Files')
        .findOne({
          postId: post._id,
          _id: new fastify.mongo.ObjectId(req.params.fileId),
          // extension: fileExt
        })

      if (!file) {
        throw new Error('Not Found File')
      }

      let mimetype = file.mimetype
      let filename = file.filename

      const buf = await LoadFile(String(file._id))

      reply
        .header('Content-Type', mimetype)
        .header('Content-Disposition', `attachment;filename="${encodeURI(filename)}"`)
        .send(buf)

    } catch (err) {
      console.error(err)
      reply.code(400).send(err)
    }

    return
  })

  fastify.get('/thumbnail', async (req, reply) => {
    let _id = null

    try {
      const email = await fastify.auth0.checkSignIn(fastify, req.headers)
      if (!email) {
        // throw new Error('Invalid Token')
      }

      const config = await GetConfig(fastify)
      if (!config.isOpen && !email) {
        throw new Error('Need Login')
      }

      let currentUser
      if (email) {
        currentUser = await CurrentUser(fastify, email)
      }

      let post = await fastify.mongo.db
        .collection('Posts')
        .findOne({
          _id: new fastify.mongo.ObjectId(req.params.id),
          // deleted: { $ne: true }
        })
      if (!post) {
        throw new Error('Not Found Post')
      }

      const file = await fastify.mongo.db
        .collection('Files')
        .findOne({
          postId: post._id,
          _id: new fastify.mongo.ObjectId(req.params.fileId),
          // extension: fileExt
        })

      if (!file) {
        throw new Error('Not Found File')
      } else if (!file.thumbnailId) {
        throw new Error('Not Found Thumbnail')
      }

      let mimetype = 'image/jpeg'
      let filename = 'thumbnail.jpg'

      const buf = await LoadFile(String(file.thumbnailId))

      reply
        .header('Content-Type', mimetype)
        .header('Content-Disposition', `attachment;filename="${encodeURI(filename)}"`)
        .send(buf)

    } catch (err) {
      console.error(err)
      reply.code(400).send(err)
    }

    return
  })
}

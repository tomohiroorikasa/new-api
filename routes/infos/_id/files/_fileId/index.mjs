import { Clone, GetConfig, CurrentUser, LoadFile } from "../../../../../lib.mjs"

export default async function (fastify, opts) {
  fastify.get('/', async (req, reply) => {
    let _id = null

    try {
      const email = await fastify.auth0.checkSignIn(fastify, req.headers)
      if (!email) {
        // throw new Error('Invalid Token')
      }

      // const config = await GetConfig(fastify)
      // if (!config.isOpen && !email) throw new Error('Need Login')

      let currentUser
      if (email) {
        currentUser = await CurrentUser(fastify, email)
      }

      let info = await fastify.mongo.db
        .collection('Infos')
        .findOne({
          _id: new fastify.mongo.ObjectId(req.params.id),
          // deleted: { $ne: true }
        })
      if (!info) {
        throw new Error('Not Found Info')
      }

      const file = await fastify.mongo.db
        .collection('Files')
        .findOne({
          infoId: info._id,
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

      // const config = await GetConfig(fastify)
      // if (!config.isOpen && !email) throw new Error('Need Login')

      let currentUser
      if (email) {
        currentUser = await CurrentUser(fastify, email)
      }

      let info = await fastify.mongo.db
        .collection('Infos')
        .findOne({
          _id: new fastify.mongo.ObjectId(req.params.id),
          // deleted: { $ne: true }
        })
      if (!info) {
        throw new Error('Not Found Info')
      }

      const file = await fastify.mongo.db
        .collection('Files')
        .findOne({
          infoId: info._id,
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

  fastify.post('/', async (req, reply) => {
    let ret = false

    try {
      const email = await fastify.auth0.checkSignIn(fastify, req.headers)
      if (!email) throw new Error('Invalid Token')

      const currentUser = await CurrentUser(fastify, email)
      if (!currentUser) throw new Error('Not Found User')

      // const config = await GetConfig(fastify)
      // if (!config.isOpen && !email) throw new Error('Need Login')

      const info = await fastify.mongo.db
        .collection('Infos')
        .findOne({
          _id: new fastify.mongo.ObjectId(req.params.id),
          deleted: { $ne: true }
        })
      if (!info) {
        throw new Error('Not Found Info')
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
      for (const fileId of info.files || []) {
        if (String(fileId) === String(file._id)) {
          throw new Error('Already Exists FileId')
        }
        files.push(fileId)
      }

      files.push(file._id)

      await fastify.mongo.db.collection('Infos').updateOne({
        _id: info._id
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

      const info = await fastify.mongo.db
        .collection('Infos')
        .findOne({
          _id: new fastify.mongo.ObjectId(req.params.id),
          deleted: { $ne: true }
        })
      if (!info) {
        throw new Error('Not Found Info')
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
      for (const fileId of info.files || []) {
        files.push(String(fileId))
      }

      if (!files.includes(String(file._id))) {
        throw new Error('Not Found FileId')
      }

      const updatedFiles = []
      for (const fileId of info.files || []) {
        if (String(fileId) !== String(file._id)) {
          updatedFiles.push(fileId)
        }
      }

      await fastify.mongo.db.collection('Infos').updateOne({
        _id: info._id
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

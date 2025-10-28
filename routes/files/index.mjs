import { IsBoolean, IsNumber, CurrentUser, RecursiveEach, SaveFile } from '../../lib.mjs'

import reallyRelaxedJson from 'really-relaxed-json'
const { toJson } = reallyRelaxedJson

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

      let matches = { $and: [{ deleted: { $ne: true } }] }

      if (req.query.filter && req.query.filter !== '') {
        let queryFilter = JSON.parse(toJson(req.query.filter))

        if (queryFilter.$and && queryFilter.$and.length > 0) {
          for (let i = 0; i < queryFilter.$and.length; i++) {
            const cond = queryFilter.$and[i]
            if (!cond) continue

            if (cond.$keywords) {
              const keywordFilters = cond.$keywords.map(k => ({
                filename: { $regex: k, $options: 'i' }
              }))
              queryFilter.$and[i] = { $or: keywordFilters }
            }
          }
          queryFilter.$and = queryFilter.$and.filter(Boolean)
        }

        RecursiveEach(queryFilter, (key, value) => {
          if (value === null) {
            return null
          } else if (IsBoolean(value)) {
            return value
          } else if (IsNumber(value)) {
            return value
          } else if (value.match(/^Date:\(\'(.+)\'\)$/)) {
            return dayjs(RegExp.$1).toDate()
          } else if (value.match(/^ObjectId:\(\'(.+)\'\)$/)) {
            return new fastify.mongo.ObjectId(RegExp.$1, 'g')
          } else {
            return null
          }
        })

        matches.$and.push(queryFilter)
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
        .find(matches)
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

  fastify.post('/upload', async (req, reply) => {
    let ret = {}

    try {
      const email = await fastify.auth0.checkSignIn(fastify, req.headers)
      if (!email) throw new Error('Invalid Token')

      const currentUser = await CurrentUser(fastify, email)
      if (!currentUser) throw new Error('Not Found User')

      let files = []
      const uploadFiles = await req.files()

      for await (const uploadFile of uploadFiles) {
        const inserted = await fastify.mongo.db
          .collection('Files')
          .insertOne({
            filename: uploadFile.filename,
            encoding: uploadFile.encoding,
            mimetype: uploadFile.mimetype,
            // length: uploadFile.file.length,
            postedBy: currentUser._id,
            postedAt: new Date()
          })

        ret._id = inserted.insertedId

        const fileId = inserted.insertedId

        let fileInfo = { _id: fileId }

        const _bufs = []
        for await (const _buf of uploadFile.file) {
          _bufs.push(_buf)
        }
        const buf = Buffer.concat(_bufs)

        await SaveFile(String(fileId), buf, uploadFile.mimetype)

        /*
        const thumbnailId = await ThumbnailFile(fastify, fileId, buf, uploadFile.mimetype, [800, 800], { chatId: chat._id, type: 'message' })
        if (thumbnailId) {
          fileInfo.thumbnailId = thumbnailId
        }
        */

        files.push(fileInfo)
      }
    } catch (e) {
      console.log(e)
      reply.code(400).send(e)
    }

    return ret
  })
}

import { GetConfig, LoadFile } from "../../../../lib.mjs"

export default async function (fastify, opts) {
  fastify.get('/', async (req, reply) => {
    let ret

    try {
      const file = await fastify.mongo.db
        .collection('Files')
        .findOne({
          _id: new fastify.mongo.ObjectId(req.params.id),
          deleted: { $ne: true }
        })
      if (!file) throw new Error('Not Found File')

      const config = await GetConfig(fastify)

      if (typeof req.query.thumbnail !== 'undefined' && file.thumbnailId) {
        ret = await LoadFile(String(file.thumbnailId))
      } else {
        ret = await LoadFile(String(file._id))
      }

      reply
        .type(file.mimetype)
        .header('Cross-Origin-Resource-Policy', 'cross-origin')
        .send(ret)
    } catch (err) {
      console.error(err)
      reply.code(400).send(err)
      return
    }
    // return ret
  })
}

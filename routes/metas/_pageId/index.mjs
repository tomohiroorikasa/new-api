import { FilterData, GetConfig } from "../../../lib.mjs"

const schema = {
  title: 1,
  description: 1,
}

export default async function (fastify, opts) {
  fastify.get('/', async (req, reply) => {
    let ret = {}

    try {
      const meta = await fastify.mongo.db
        .collection('Metas')
        .findOne({
          id: req.params.pageId,
        })
      if (!meta) {
        throw new Error('Not Found Meta')
      }

      ret = FilterData(meta, schema)
    } catch (err) {
      console.error(err)
      reply.code(400).send(err)
      return
    }

    return ret
  })
}

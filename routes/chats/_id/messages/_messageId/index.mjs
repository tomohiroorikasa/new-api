import path from 'path'

import { IsBoolean, IsNumber, FilterData, GetConfig, GetUid, CurrentUser, ValidateData, RecursiveEach } from "../../../../../lib.mjs"

import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import 'dayjs/locale/ja.js'

import reallyRelaxedJson from 'really-relaxed-json'
const { toJson } = reallyRelaxedJson

dayjs.extend(utc)
dayjs.locale('ja')

const schema = {
  message: 1,
  chatId: 1,
  postedAt: 1,
  sent: 1,
}

export default async function (fastify, opts) {
  fastify.get('/', async (req, reply) => {
    let ret = {}
    try {
      const uid = await GetUid(fastify, req)
      if (!uid) throw new Error('Empty Uid')

      const chat = await fastify.mongo.db
        .collection('Chats')
        .findOne({
          uid: uid,
          deleted: { $ne: true }
        })
      if (!chat) {
        throw new Error('Not Found Chat')
      }

      const message = await fastify.mongo.db
        .collection('Messages')
        .findOne({
          chatId: chat._id,
          _id: new fastify.mongo.ObjectId(req.params.messageId),
          deleted: { $ne: true }
        })
      if (!message) {
        throw new Error('Not Found Message')
      }

      // const config = await GetConfig(fastify)

      ret = FilterData(message, schema)

    } catch (err) {
      console.error(err)
      reply.code(400).send(err)
      return
    }

    return ret
  })
}

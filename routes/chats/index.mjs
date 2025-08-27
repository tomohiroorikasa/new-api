import urlJoin from 'url-join'

import { GetConfig, GetUid, FilterData, ValidateData } from '../../lib.mjs'

/*
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import 'dayjs/locale/ja.js'

dayjs.extend(utc)
dayjs.locale('ja')
*/

const schema = {
  uid: 1,
  profile: 1,
}

const postRules = {
  uid: {
    required: true,
    isUuid: true
  },
  name: {
    required: true,
    maxLength: 20,
  },
  email: {
    required: true,
    isEmail: true
  },
}

export default async function (fastify, opts) {
  fastify.get('/', async (req, reply) => {
    let ret = {}
    try {
      const uid = await GetUid(fastify, req)
      if (!uid) {
        throw new Error('Empty Uid')
      }

      const chat = await fastify.mongo.db
        .collection('Chats')
        .findOne({
          uid: uid,
          deleted: { $ne: true }
        })
      if (!chat) {
        throw new Error('Not Found Chat')
      }

      // const config = await GetConfig(fastify)

      ret = FilterData(chat, schema)

    } catch (err) {
      console.error(err)
      reply.code(400).send(err)
      return
    }

    return ret
  })

  fastify.post('/', async (req, reply) => {
    let ret = {}

    try {
      const uid = await GetUid(fastify, req)
      if (!uid) {
        throw new Error('Empty Uid')
      }

      let chat = {}

      if (!req.body) {
        throw new Error('Empty Body')
      }

      const [isValid, incorrects, data] = ValidateData(req.body, postRules)
      if (!isValid) {
        throw new Error(`Incorrect Parameters - ${incorrects.join(',')}`)
      }

      chat = await fastify.mongo.db
        .collection('Chats')
        .findOne({
          uid: uid,
          deleted: { $ne: true }
        })

      if (!chat || !chat._id) {
        chat = {
          uid: uid,
          postedAt: new Date(),
          profile: {
            name: data.name,
            email: data.email
          }
        }

        const inserted = await fastify.mongo.db
          .collection('Chats')
          .insertOne(chat)

        chat._id = inserted.insertedId
      }

      ret._id = chat._id

    } catch (e) {
      console.error(e)
      reply.code(400).send(e)
      return
    }

    return ret
  })
}

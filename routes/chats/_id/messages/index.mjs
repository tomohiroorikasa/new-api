import path from 'path'

import { IsBoolean, IsNumber, FilterData, GetConfig, GetUid, CurrentUser, ValidateData, RecursiveEach, ModerateMessage } from "../../../../lib.mjs"

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

const postRules = {
  message: {
    required: true,
    maxLength: 2000,
    // regex: /^[a-z][0-9A-Za-z_]+[0-9A-Za-z]$/
  },
  force: {
    isBoolean: true
  },
}

export default async function (fastify, opts) {
  fastify.get('/count', async (req, reply) => {
    let ret = 0

    try {
      const uid = await GetUid(fastify, req)
      if (!uid) throw new Error('Empty Uid')

      const chat = await fastify.mongo.db
        .collection('Chats')
        .findOne({
          uid: uid,
          deleted: { $ne: true }
        })
      if (!chat) throw new Error('Not Found Chat')

      let matches = {
        $and: [
          { chatId: chat._id },
          { deleted: { $ne: true } }
        ]
      }

      if (req.query.filter && req.query.filter !== '') {
        let queryFilter = JSON.parse(toJson(req.query.filter))

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

      let aggregate = [{
        $match: matches
      }]

      aggregate.push({
        $count: 'count'
      })

      const arr = await fastify.mongo.db
        .collection('Messages')
        .aggregate(aggregate)
        .toArray()
      if (arr.length > 0 && arr[0] && arr[0].count) {
        ret = arr[0].count
      }

    } catch (e) {
      console.log(e)
      reply.code(400).send(e)
      return
    }

    return ret
  })

  fastify.get('/', async (req, reply) => {
    let ret = []

    try {
      const uid = await GetUid(fastify, req)
      if (!uid) throw new Error('Empty Uid')

      const chat = await fastify.mongo.db
        .collection('Chats')
        .findOne({
          uid: uid,
          deleted: { $ne: true }
        })
      if (!chat) throw new Error('Not Found Chat')

      let matches = {
        $and: [
          { chatId: chat._id },
          { deleted: { $ne: true } }
        ]
      }

      if (req.query.filter && req.query.filter !== '') {
        let queryFilter = JSON.parse(toJson(req.query.filter))

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

      let aggregate = [
        {
          $match: matches
        }, {
          $project: Object.assign({
            _id: 1,
            postedAt: 1,
          }, schema)
          /*
          $project: {
            _id: 1,
            userId: 1,
            postedAt: 1,
          }
          */
        }
      ]

      if (req.query.sort) {
        let sort = {}
        for (let field of req.query.sort.split(',')) {
          let order = 1
          if (field.substr(0, 1) === '-') {
            field = field.substr(1)
            order = -1
          }
          sort[field] = order
        }
        aggregate.push({ $sort: sort })
      }

      let skip = 0
      if (req.query.skip) {
        skip = Number(req.query.skip)
      }
      if (skip > 0) {
        aggregate.push({ $skip: skip })
      }

      let limit = 100
      if (req.query.limit) {
        limit = Number(req.query.limit)
      }
      if (limit !== -1) {
        aggregate.push({ $limit: limit })
      }

      const messages = await fastify.mongo.db
        .collection('Messages')
        .aggregate(aggregate)
        .toArray()

      for (let message of messages) {
        let row = FilterData(message, schema)

        ret.push(row)
      }

    } catch (e) {
      console.log(e)
      reply.code(400).send(e)
      return
    }

    return ret
  })

  fastify.post('/', async (req, reply) => {
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
      if (!chat) throw new Error('Not Found Chat')

      if (!req.body) throw new Error('Empty Body')

      const [isValid, incorrects, data] = ValidateData(req.body, postRules)
      if (!isValid) {
        throw new Error(`Incorrect Parameters - ${incorrects.join(',')}`)
      }

      const config = await GetConfig(fastify)

      if (data.message) {
        if (process.env.OPENAI_API_KEY && config.useModerator) {
          if (data.force) {
            data.mask = true
          } else {
            const res = await ModerateMessage(fastify, config, data.message)

            if (res.match(/NG/i)) {
              if (!data.force) {
                throw new Error('Violation Certainly')
              } else {
                data.mask = true
              }
            } else if (res.match(/DONNO/i)) {
              if (!data.force) {
                throw new Error('Violation Perhaps')
              } else {
                data.mask = true
              }
            } else if (res.match(/OK/i)) {
              data.mask = false
            }
          }
        }
      }

      data.chatId = chat._id
      data.postedAt = new Date()
      data.sent = true

      let isViolation = false
      if (data.force) {
        isViolation = true
        delete data.force
      }

      const inserted = await fastify.mongo.db
        .collection('Messages')
        .insertOne(data)

      ret._id = inserted.insertedId

      await fastify.mongo.db
        .collection('Chats')
        .updateOne({
          _id: chat._id,
        }, {
          $set: {
            messagedAt: new Date(),
            latestEnteredAt: new Date()
          }
        })

    } catch (e) {
      console.log(e)
      reply.code(400).send(e)
      return
    }

    return ret
  })
}

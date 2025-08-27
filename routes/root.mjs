//import { wsAuthMiddleware } from '../plugins/socket.mjs'

import { CurrentUser } from "../lib.mjs"

import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import 'dayjs/locale/ja.js'

dayjs.extend(utc)
dayjs.locale('ja')

export default async function (fastify, opts) {
  fastify.get('/', async function (req, reply) {
    return { root: true }
  })

  fastify.get('/ping', async function (req, reply) {
    return 'pong'
  })

  fastify.get('/echo/:name', async function (req, reply) {
    return { param: req.params.name }
  })

  fastify.get('/db', async function (req, reply) {
    let ret = null
    try {
      const stats = await fastify.mongo.db.stats()
      ret = stats.ok
    } catch (e) {
      // ret = null
    }
    return { status: ret }
  })

  fastify.get('/cache', async function (req, reply) {
    let ret = null
    try {
      await fastify.redis.set('hello', 'world')
      const res = await fastify.redis.get('hello')
      if (res === 'world') {
        ret = 'ok'
      } else {
        ret = 'ng'
      }
      await fastify.redis.del('hello')
    } catch (e) {
      console.log(e)
      // ret = null
    }

    return { status: ret }
  })

  const ns = fastify.io.of('/').on('connection', (socket) => {
    socket.on('msg', async (data) => {
      try {
        let pieces = data.split(/:|,/)
        let msg
        if (pieces[0] === 'data') {
          if (pieces[1].match(/^application\/vnd\.(.+)/)) {
            let method = RegExp.$1
          }
        }
      } catch(e) {
        console.error(e)
      }
      return
    })
  })

  fastify.ns = ns

  // ns.use(wsAuthMiddleware(fastify))
}

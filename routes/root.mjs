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

  /*
  const ns = fastify.io.of('/').on('connection', (socket) => {
    socket.on('join', async () => {
      try {
        const email = await fastify.auth0.checkSocketToken(fastify, socket.handshake.auth)
        if (!email) {
          throw new Error('Invalid Token')
        }

        const currentUser = await CurrentUser(fastify, email)
        if (!currentUser) {
          throw new Error('Not Found User')
        } else {
          fastify.mongo.db
            .collection('Users')
            .updateOne({
              _id: currentUser._id
            }, {
              $set: {
                joined: true,
                latestJoinedAt: new Date(),
              }
            })

          await socket.join(String(currentUser._id))

          ns.emit('msg', 'data:application/vnd.join,' + currentUser._id)
        }
      } catch (e) {
        console.error(e)
      }
      return
    })

    socket.on('leave', async () => {
      try {
        const email = await fastify.auth0.checkSocketToken(fastify, socket.handshake.auth)
        if (!email) {
          throw new Error('Invalid Token')
        }

        const currentUser = await CurrentUser(fastify, email)
        if (!currentUser) {
          throw new Error('Not Found User')
        } else {
          fastify.mongo.db
            .collection('Users')
            .updateOne({
              _id: user._id
            }, {
              $set: {
                joined: false
              }
            })

          await socket.leave(String(currentUser._id))

          ns.emit('msg', 'data:application/vnd.leave,' + currentUser._id)
        }
      } catch (e) {
        console.error(e)
      }
      return
    })

    socket.on('msg', async (data) => {
      try {
        const email = await fastify.auth0.checkSocketToken(fastify, socket.handshake.auth)
        if (!email) {
          throw new Error('Invalid Token')
        }

        const currentUser = await CurrentUser(fastify, email)
        if (!currentUser) {
          throw new Error('Not Found User')
        } else {
          let pieces = data.split(/:|,/)
          let msg
          if (pieces[0] === 'data') {
            if (pieces[1].match(/^application\/vnd\.(.+)/)) {
              let method = RegExp.$1

              let isBeforeJoined = currentUser.joined
              if (isBeforeJoined && (!currentUser.latestJoinedAt || dayjs().diff(currentUser.latestJoinedAt, 'second') > 300)) {
                isBeforeJoined = false
              }

              if (!isBeforeJoined && method !== 'leave' && method !== 'chatleave') {
                await fastify.mongo.db
                  .collection('Users')
                  .updateOne({
                    _id: currentUser._id
                  }, {
                    $set: {
                      joined: true,
                      latestJoinedAt: new Date()
                    }
                  })
              }

              if (method === 'pong') {
                if (!isBeforeJoined) {
                  ns.emit('msg', `data:application/vnd.join,${currentUser._id}`)
                }
              } else if (method === 'join') {
                ns.emit('msg', `data:application/vnd.join,${currentUser._id}`)

              } else if (method === 'leave') {
                fastify.mongo.db
                  .collection('Users')
                  .updateOne({
                    _id: currentUser._id
                  }, {
                    $set: {
                      joined: false
                    }
                  })

                ns.emit('msg', `data:application/vnd.leave,${currentUser._id}`)

              } else if (method === 'chatjoin') {
                // join chat
                const chatId = decodeURIComponent(pieces[2])

                const chat = await fastify.mongo.db
                  .collection('Chats')
                  .find({
                    $and: [
                      { _id: new fastify.mongo.ObjectId(chatId) },
                      { userIds: { $in: [ currentUser._id ] } }
                    ]
                  })
                  .toArray()

                if (chat) {
                  await fastify.mongo.db
                    .collection('Chats')
                    .updateOne({
                      _id: chat._id,
                    }, {
                      $set: {
                        latestChattedAt: currentUser._id,
                        latestChattedBy: chat._id,
                        chattedBy: new Date()
                      }
                    })

                  await socket.join(chatId)

                  ns.to(chatId).emit('msg', `data:application/vnd.chatjoin,${chatId}/${currentUser._id}`)
                }
              } else if (method === 'chatleave') {
                // leave chat
                const chatId = decodeURIComponent(pieces[2])

                const chat = await fastify.mongo.db
                  .collection('Chats')
                  .find({
                    $and: [
                      { _id: new fastify.mongo.ObjectId(chatId) },
                      { userIds: { $in: [ currentUser._id ] } }
                    ]
                  })
                  .toArray()

                if (chat) {
                  ns.to(chatId).emit('msg', `data:application/vnd.chatleave,${chatId}/${currentUser._id}`)

                  socket.leave(chatId)
                }
              } else {
                console.log('irregular msg', method)
              }
            } else {
              console.log('irregular msg', pieces[1])
            }
          }
        }
      } catch(e) {
        console.error(e)
      }
      return
    })
  })

  fastify.ns = ns
  */
  // ns.use(wsAuthMiddleware(fastify))
}
